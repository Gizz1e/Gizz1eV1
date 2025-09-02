from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, Request, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import gridfs
from gridfs import GridFS
import pymongo
import os
import io
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import mimetypes
import json
import asyncio

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# Import our WebRTC and streaming modules
from webrtc_manager import webrtc_manager, StreamType
from websocket_manager import websocket_manager, MessageType
from auth_manager import auth_manager, User, ModelApplication

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Synchronous MongoDB client for GridFS
sync_client = pymongo.MongoClient(mongo_url)
sync_db = sync_client[os.environ['DB_NAME']]

# GridFS for file storage
fs = gridfs.GridFS(sync_db)

# Create the main app without a prefix
app = FastAPI(title="Gizzle TV L.L.C. API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class ContentItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    category: str  # "videos", "pictures", "live_streams"
    upload_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    thumbnail_id: Optional[str] = None
    processing_status: str = "pending"  # pending, processing, completed, failed

class ContentItemCreate(BaseModel):
    category: str
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None

class CommunityMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    member_since: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    subscription_status: str = "free"  # free, premium, vip
    total_uploads: int = 0
    bio: Optional[str] = None

class CommunityMemberCreate(BaseModel):
    username: str
    email: str
    display_name: str
    bio: Optional[str] = None

class SubscriptionPlan(BaseModel):
    id: str
    name: str
    price: float
    currency: str
    interval: str  # monthly, yearly
    features: List[str]
    is_popular: bool = False

class ModelProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    username: str
    category: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    verification_status: str = "pending"  # pending, verified, rejected
    subscription_count: int = 0
    video_count: int = 0
    total_views: int = 0
    rating: float = 0.0
    joined_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    social_links: Dict[str, str] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    is_featured: bool = False
    subscription_price: Optional[float] = None

class ModelProfileCreate(BaseModel):
    name: str
    username: str
    category: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    social_links: Dict[str, str] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    subscription_price: Optional[float] = None

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    amount: float
    currency: str
    payment_status: str  # pending, paid, failed, expired
    plan_id: Optional[str] = None
    member_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = Field(default_factory=dict)

# New models for WebRTC streaming
class LiveStreamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    stream_type: str = "public"  # public, private, premium
    max_viewers: int = 1000

class LiveStreamInfo(BaseModel):
    stream_id: str
    title: str
    description: Optional[str]
    stream_type: str
    streamer_id: str
    streamer_username: str
    viewer_count: int
    is_active: bool
    created_at: datetime
    max_viewers: int
    tips_received: float

class WebRTCOffer(BaseModel):
    sdp: str
    type: str

class WebRTCAnswer(BaseModel):
    sdp: str
    type: str

class ICECandidate(BaseModel):
    candidate: str
    sdpMLineIndex: int
    sdpMid: str

class TipRequest(BaseModel):
    stream_id: str
    amount: float
    message: Optional[str] = None

class UserRegistration(BaseModel):
    username: str
    email: str
    password: str
    is_model_application: bool = False

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class ModelApplicationCreate(BaseModel):
    stage_name: str
    real_name: str
    email: str
    phone: Optional[str] = None
    bio: str
    social_links: Dict[str, str] = Field(default_factory=dict)
    identity_document_ids: List[str] = Field(default_factory=list)
    portfolio_file_ids: List[str] = Field(default_factory=list)

# Subscription plans
SUBSCRIPTION_PLANS = {
    "basic": SubscriptionPlan(
        id="basic",
        name="Basic Plan",
        price=9.99,
        currency="usd",
        interval="monthly",
        features=["Upload videos up to 100MB", "5 videos per day", "Basic community access"]
    ),
    "premium": SubscriptionPlan(
        id="premium", 
        name="Premium Plan",
        price=19.99,
        currency="usd",
        interval="monthly",
        features=["Upload videos up to 1GB", "Unlimited uploads", "Premium community features", "Live streaming access"],
        is_popular=True
    ),
    "vip": SubscriptionPlan(
        id="vip",
        name="VIP Plan", 
        price=39.99,
        currency="usd",
        interval="monthly",
        features=["Unlimited everything", "Priority support", "Exclusive community access", "Advanced analytics"]
    )
}

# Routes
@api_router.get("/")
async def root():
    return {"message": "Welcome to Gizzle TV L.L.C. API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

# Content Management Endpoints
@api_router.post("/content/upload")
async def upload_content(
    category: str = Form(...),
    description: str = Form(None),
    tags: str = Form(""),
    file: UploadFile = File(...)
):
    """Upload video or image content with support for large files"""
    
    # Validate category
    valid_categories = ["videos", "pictures", "live_streams"]
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    # Enhanced file size limits for high-quality content
    max_file_sizes = {
        "videos": 10 * 1024 * 1024 * 1024,  # 10GB for videos
        "pictures": 100 * 1024 * 1024,       # 100MB for pictures
        "live_streams": 5 * 1024 * 1024 * 1024  # 5GB for live streams
    }
    
    # Validate file type and size
    if category == "videos":
        if not file.content_type.startswith("video/"):
            raise HTTPException(status_code=400, detail="Invalid file type for videos")
    elif category == "pictures":
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Invalid file type for pictures")
    
    # Check file size
    file_size = 0
    file_content = b""
    
    # Read file in chunks to handle large files efficiently
    chunk_size = 1024 * 1024  # 1MB chunks
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        file_content += chunk
        file_size += len(chunk)
        
        # Check if file exceeds size limit
        if file_size > max_file_sizes.get(category, 100 * 1024 * 1024):
            raise HTTPException(
                status_code=413, 
                detail=f"File too large. Maximum size for {category}: {max_file_sizes[category] // (1024*1024*1024)}GB" if max_file_sizes[category] >= 1024*1024*1024 else f"{max_file_sizes[category] // (1024*1024)}MB"
            )
    
    # Process tags
    tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else []
    
    # Store in GridFS with metadata
    file_id = fs.put(
        file_content,
        filename=file.filename,
        content_type=file.content_type,
        metadata={
            "category": category,
            "original_size": file_size,
            "upload_timestamp": datetime.now(timezone.utc),
            "high_quality": file_size > (100 * 1024 * 1024),  # Mark as high-quality if > 100MB
            "tags": tag_list
        }
    )
    
    # Create content item with enhanced metadata
    content_item = ContentItem(
        filename=str(file_id),
        original_filename=file.filename,
        content_type=file.content_type,
        file_size=file_size,
        category=category,
        tags=tag_list,
        description=description or f"High-quality {category.rstrip('s')} upload - {file.filename}",
        processing_status="completed" if category == "pictures" else "processing"  # Videos may need processing
    )
    
    # Save to database
    await db.content_items.insert_one(content_item.dict())
    
    logger.info(f"Successfully uploaded {file.filename} ({file_size} bytes) in category {category}")
    
    return {
        "message": "Content uploaded successfully", 
        "content_id": content_item.id,
        "file_size": file_size,
        "high_quality": file_size > (100 * 1024 * 1024),
        "processing_status": content_item.processing_status
    }

@api_router.get("/content/{category}")
async def get_content_by_category(category: str):
    """Get content by category"""
    valid_categories = ["videos", "pictures", "live_streams"]
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    content_items = await db.content_items.find({"category": category}).to_list(100)
    return [ContentItem(**item) for item in content_items]

@api_router.get("/content/file/{file_id}")
async def get_file(file_id: str):
    """Stream file content"""
    try:
        file_data = fs.get(file_id)
        
        def iterfile():
            yield file_data.read()
        
        return StreamingResponse(
            iterfile(), 
            media_type=file_data.content_type,
            headers={"Content-Disposition": f"inline; filename={file_data.filename}"}
        )
    except gridfs.errors.NoFile:
        raise HTTPException(status_code=404, detail="File not found")

# Models Endpoints
@api_router.post("/models", response_model=ModelProfile)
async def create_model_profile(profile_data: ModelProfileCreate):
    """Create a new model profile"""
    
    # Check if username already exists
    existing_model = await db.model_profiles.find_one({"username": profile_data.username})
    if existing_model:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    profile = ModelProfile(**profile_data.dict())
    await db.model_profiles.insert_one(profile.dict())
    
    return profile

@api_router.get("/models", response_model=List[ModelProfile])
async def get_models(
    featured: Optional[bool] = None,
    category: Optional[str] = None,
    verified: Optional[bool] = None,
    limit: int = 20
):
    """Get model profiles with optional filtering"""
    
    query = {}
    
    if featured is not None:
        query["is_featured"] = featured
    
    if category:
        query["category"] = category
    
    if verified is not None:
        query["verification_status"] = "verified" if verified else {"$ne": "verified"}
    
    models = await db.model_profiles.find(query).limit(limit).to_list(limit)
    return [ModelProfile(**model) for model in models]

@api_router.get("/models/{model_id}", response_model=ModelProfile)
async def get_model_profile(model_id: str):
    """Get a specific model profile"""
    
    model = await db.model_profiles.find_one({"id": model_id})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return ModelProfile(**model)

@api_router.put("/models/{model_id}/verify")
async def verify_model(model_id: str):
    """Verify a model profile (admin function)"""
    
    result = await db.model_profiles.update_one(
        {"id": model_id},
        {
            "$set": {
                "verification_status": "verified",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return {"message": "Model verified successfully"}

@api_router.put("/models/{model_id}/feature")
async def feature_model(model_id: str, featured: bool = True):
    """Feature/unfeature a model profile (admin function)"""
    
    result = await db.model_profiles.update_one(
        {"id": model_id},
        {
            "$set": {
                "is_featured": featured,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return {"message": f"Model {'featured' if featured else 'unfeatured'} successfully"}

# Community Endpoints
@api_router.post("/community/members", response_model=CommunityMember)
async def create_member(member_data: CommunityMemberCreate):
    """Create a new community member"""
    
    # Check if username already exists
    existing_member = await db.community_members.find_one({"username": member_data.username})
    if existing_member:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email already exists  
    existing_email = await db.community_members.find_one({"email": member_data.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    member = CommunityMember(**member_data.dict())
    await db.community_members.insert_one(member.dict())
    
    return member

@api_router.get("/community/members", response_model=List[CommunityMember])
async def get_community_members(limit: int = 20):
    """Get community members"""
    members = await db.community_members.find().limit(limit).to_list(limit)
    return [CommunityMember(**member) for member in members]

# Subscription Endpoints
@api_router.get("/subscriptions/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return list(SUBSCRIPTION_PLANS.values())

@api_router.post("/subscriptions/checkout")
async def create_subscription_checkout(
    plan_id: str,
    request: Request
):
    """Create subscription checkout session"""
    
    # Validate plan
    if plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid subscription plan")
    
    plan = SUBSCRIPTION_PLANS[plan_id]
    
    # Get Stripe API key
    stripe_api_key = os.environ.get('STRIPE_API_KEY')
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Initialize Stripe checkout
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    # Create success and cancel URLs
    success_url = f"{host_url}/subscription-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/subscriptions"
    
    # Create checkout session request
    checkout_request = CheckoutSessionRequest(
        amount=plan.price,
        currency=plan.currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "plan_id": plan_id,
            "plan_name": plan.name,
            "type": "subscription"
        }
    )
    
    try:
        # Create checkout session
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction = PaymentTransaction(
            session_id=session.session_id,
            amount=plan.price,
            currency=plan.currency,
            payment_status="pending",
            plan_id=plan_id,
            metadata={
                "plan_name": plan.name,
                "type": "subscription"
            }
        )
        
        # Save transaction to database
        await db.payment_transactions.insert_one(transaction.dict())
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "plan": plan.dict()
        }
        
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

# In-App Purchase Endpoints  
@api_router.post("/purchases/checkout")
async def create_purchase_checkout(
    item_id: str,
    request: Request
):
    """Create in-app purchase checkout session"""
    
    # Define in-app purchase items
    purchase_items = {
        "premium_upload": {"name": "Premium Upload Credits", "price": 4.99, "description": "10 premium upload credits"},
        "live_stream_hours": {"name": "Live Stream Hours", "price": 9.99, "description": "5 additional live stream hours"},
        "premium_features": {"name": "Premium Features", "price": 2.99, "description": "Unlock premium editing features"}
    }
    
    if item_id not in purchase_items:
        raise HTTPException(status_code=400, detail="Invalid purchase item")
    
    item = purchase_items[item_id]
    
    # Get Stripe API key
    stripe_api_key = os.environ.get('STRIPE_API_KEY')
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Initialize Stripe checkout
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    # Create success and cancel URLs
    success_url = f"{host_url}/purchase-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/store"
    
    # Create checkout session request
    checkout_request = CheckoutSessionRequest(
        amount=item["price"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "item_id": item_id,
            "item_name": item["name"],
            "type": "purchase"
        }
    )
    
    try:
        # Create checkout session
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction = PaymentTransaction(
            session_id=session.session_id,
            amount=item["price"],
            currency="usd",
            payment_status="pending",
            metadata={
                "item_id": item_id,
                "item_name": item["name"],
                "type": "purchase"
            }
        )
        
        # Save transaction to database
        await db.payment_transactions.insert_one(transaction.dict())
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "item": item
        }
        
    except Exception as e:
        logger.error(f"Error creating purchase checkout: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

# Payment Status Endpoints
@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str):
    """Get payment status for a session"""
    
    # Get Stripe API key
    stripe_api_key = os.environ.get('STRIPE_API_KEY')
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Initialize Stripe checkout
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url="")
    
    try:
        # Get checkout status from Stripe
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
        
        # Find transaction in database
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        
        if transaction:
            # Update transaction status if payment is completed and not already processed
            if checkout_status.payment_status == "paid" and transaction["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {
                        "$set": {
                            "payment_status": "paid",
                            "updated_at": datetime.now(timezone.utc)
                        }
                    }
                )
                
                # Here you can add logic to grant premium features, credits, etc.
                logger.info(f"Payment completed for session {session_id}")
        
        return {
            "session_id": session_id,
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency,
            "metadata": checkout_status.metadata
        }
        
    except Exception as e:
        logger.error(f"Error checking payment status: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

# Stripe Webhook Endpoint
@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    
    # Get Stripe API key
    stripe_api_key = os.environ.get('STRIPE_API_KEY')
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Initialize Stripe checkout
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url="")
    
    try:
        # Get request body and signature
        body = await request.body()
        signature = request.headers.get("stripe-signature", "")
        
        # Handle webhook
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.event_type == "checkout.session.completed":
            # Update payment status in database
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {
                    "$set": {
                        "payment_status": webhook_response.payment_status,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            logger.info(f"Webhook processed: {webhook_response.event_type} for session {webhook_response.session_id}")
        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=400, detail="Webhook processing failed")

# =====================
# AUTHENTICATION ENDPOINTS
# =====================

@api_router.post("/auth/viewer/register")
async def register_viewer(user_data: UserRegistration):
    """Register new viewer account"""
    try:
        # Check if username exists
        existing_user = await db.users.find_one({"username": user_data.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if email exists
        existing_email = await db.users.find_one({"email": user_data.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create viewer account (always non-model)
        user_account_data = await auth_manager.create_user_account(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            is_model_application=False  # Viewers are not models
        )
        
        # Save to database
        await db.users.insert_one(user_account_data)
        
        # Create tokens
        token_data = {
            "user_id": user_account_data["user_id"],
            "username": user_account_data["username"],
            "roles": user_account_data["roles"],
            "subscription_tier": user_account_data["subscription_tier"]
        }
        
        access_token = auth_manager.create_access_token(token_data)
        refresh_token = auth_manager.create_refresh_token(user_account_data["user_id"])
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "user_id": user_account_data["user_id"],
                "username": user_account_data["username"],
                "email": user_account_data["email"],
                "roles": user_account_data["roles"],
                "is_model": False,
                "account_type": "viewer"
            }
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Viewer registration error: {e}")
        raise HTTPException(status_code=500, detail="Viewer registration failed")

@api_router.post("/auth/viewer/login")
async def login_viewer(login_data: UserLogin):
    """Viewer login endpoint"""
    user = await auth_manager.authenticate_user(
        login_data.username_or_email, 
        login_data.password, 
        db
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create tokens
    token_data = {
        "user_id": user["user_id"],
        "username": user["username"],
        "roles": user["roles"],
        "subscription_tier": user.get("subscription_tier", "free"),
        "is_model": user.get("is_model", False),
        "model_verification_status": user.get("model_verification_status", "none")
    }
    
    access_token = auth_manager.create_access_token(token_data)
    refresh_token = auth_manager.create_refresh_token(user["user_id"])
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "roles": user["roles"],
            "is_model": user.get("is_model", False),
            "model_verification_status": user.get("model_verification_status", "none"),
            "subscription_tier": user.get("subscription_tier", "free"),
            "account_type": "viewer" if not user.get("is_model", False) else "model"
        }
    }

@api_router.post("/auth/model/login")
async def login_model(login_data: UserLogin):
    """Model-specific login endpoint"""
    user = await auth_manager.authenticate_user(
        login_data.username_or_email, 
        login_data.password, 
        db
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify user is a model
    if not user.get("is_model", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not registered as a model. Please use viewer sign-in or apply to become a model."
        )
    
    # Create tokens with model-specific data
    token_data = {
        "user_id": user["user_id"],
        "username": user["username"],
        "roles": user["roles"],
        "subscription_tier": user.get("subscription_tier", "free"),
        "is_model": True,
        "model_verification_status": user.get("model_verification_status", "pending")
    }
    
    access_token = auth_manager.create_access_token(token_data)
    refresh_token = auth_manager.create_refresh_token(user["user_id"])
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "roles": user["roles"],
            "is_model": True,
            "model_verification_status": user.get("model_verification_status", "pending"),
            "subscription_tier": user.get("subscription_tier", "free"),
            "account_type": "model"
        }
    }

# Legacy endpoints for backward compatibility
@api_router.post("/auth/register")
async def register_user(user_data: UserRegistration):
    """Register new user account (legacy - redirects to viewer registration)"""
    return await register_viewer(user_data)

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    """User login endpoint (legacy - works for both viewers and models)"""
    return await login_viewer(login_data)

# =====================
# MODEL APPLICATION ENDPOINTS
# =====================

@api_router.post("/models/apply")
async def submit_model_application(
    application_data: ModelApplicationCreate,
    current_user: Dict = Depends(auth_manager.require_auth)
):
    """Submit model verification application"""
    
    # Check if user already has a pending or approved application
    existing_app = await db.model_applications.find_one({"user_id": current_user["user_id"]})
    if existing_app:
        raise HTTPException(
            status_code=400, 
            detail="Model application already exists"
        )
    
    # Create application
    application = await auth_manager.create_model_application(
        user_id=current_user["user_id"],
        stage_name=application_data.stage_name,
        real_name=application_data.real_name,
        email=application_data.email,
        phone=application_data.phone,
        bio=application_data.bio,
        social_links=application_data.social_links,
        identity_documents=application_data.identity_document_ids,
        portfolio_files=application_data.portfolio_file_ids
    )
    
    # Save to database
    await db.model_applications.insert_one(application.dict())
    
    # Update user as model applicant
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {
                "is_model": True,
                "model_verification_status": "pending"
            }
        }
    )
    
    return {"message": "Model application submitted successfully", "application_id": application.application_id}

@api_router.get("/models/applications")
async def get_model_applications(
    status_filter: Optional[str] = None,
    current_user: Dict = Depends(auth_manager.require_permissions(["verify_models"]))
):
    """Get model applications (admin only)"""
    
    query = {}
    if status_filter:
        query["status"] = status_filter
    
    applications = await db.model_applications.find(query).to_list(100)
    return applications

@api_router.put("/models/applications/{application_id}/review")
async def review_model_application(
    application_id: str,
    action: str = Form(...),  # "approve" or "reject"
    admin_notes: str = Form(""),
    current_user: Dict = Depends(auth_manager.require_permissions(["verify_models"]))
):
    """Review model application (admin only)"""
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
    
    application = await db.model_applications.find_one({"application_id": application_id})
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Update application status
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.model_applications.update_one(
        {"application_id": application_id},
        {
            "$set": {
                "status": new_status,
                "admin_notes": admin_notes,
                "review_date": datetime.now(timezone.utc)
            }
        }
    )
    
    # Update user model status
    user_update = {"model_verification_status": new_status}
    if action == "approve":
        # Add model role if approved
        user = await db.users.find_one({"user_id": application["user_id"]})
        if user and "model" not in user.get("roles", []):
            user_update["roles"] = user.get("roles", []) + ["model"]
    
    await db.users.update_one(
        {"user_id": application["user_id"]},
        {"$set": user_update}
    )
    
    return {"message": f"Application {new_status} successfully"}

# =====================
# WEBRTC STREAMING ENDPOINTS  
# =====================

@api_router.post("/streams/create")
async def create_live_stream(
    stream_data: LiveStreamCreate,
    current_user: Dict = Depends(auth_manager.require_model_status("approved"))
):
    """Create a new live stream (verified models only)"""
    
    try:
        # Validate stream type
        if stream_data.stream_type not in ["public", "private", "premium"]:
            raise HTTPException(status_code=400, detail="Invalid stream type")
        
        # Create stream
        stream_type = StreamType(stream_data.stream_type)
        stream_id = await webrtc_manager.create_live_stream(
            streamer_id=current_user["user_id"],
            title=stream_data.title,
            stream_type=stream_type
        )
        
        # Save stream metadata to database
        stream_metadata = {
            "stream_id": stream_id,
            "streamer_id": current_user["user_id"],
            "streamer_username": current_user["username"],
            "title": stream_data.title,
            "description": stream_data.description,
            "stream_type": stream_data.stream_type,
            "max_viewers": stream_data.max_viewers,
            "created_at": datetime.now(timezone.utc),
            "is_active": False,
            "total_tips": 0.0,
            "peak_viewers": 0
        }
        
        await db.live_streams.insert_one(stream_metadata)
        
        return {
            "stream_id": stream_id,
            "message": "Stream created successfully",
            "websocket_url": f"/ws/stream/{stream_id}"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating stream: {e}")
        raise HTTPException(status_code=500, detail="Failed to create stream")

@api_router.get("/streams/active")
async def get_active_streams():
    """Get list of active streams"""
    
    active_streams = await webrtc_manager.get_active_streams()
    
    # Enhance with database information
    enhanced_streams = []
    for stream in active_streams:
        db_stream = await db.live_streams.find_one({"stream_id": stream["stream_id"]})
        if db_stream:
            enhanced_stream = {
                **stream,
                "streamer_username": db_stream.get("streamer_username", "Unknown"),
                "description": db_stream.get("description"),
                "peak_viewers": db_stream.get("peak_viewers", 0)
            }
            enhanced_streams.append(enhanced_stream)
    
    return enhanced_streams

@api_router.get("/streams/{stream_id}")
async def get_stream_info(stream_id: str):
    """Get information about a specific stream"""
    
    # Get from WebRTC manager
    stream_info = await webrtc_manager.get_stream_info(stream_id)
    if not stream_info:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    # Get additional info from database
    db_stream = await db.live_streams.find_one({"stream_id": stream_id})
    if db_stream:
        stream_info.update({
            "streamer_username": db_stream.get("streamer_username", "Unknown"),
            "description": db_stream.get("description"),
            "peak_viewers": db_stream.get("peak_viewers", 0),
            "total_tips": db_stream.get("total_tips", 0.0)
        })
    
    return stream_info

@api_router.post("/streams/{stream_id}/webrtc/offer")
async def handle_webrtc_offer(
    stream_id: str,
    offer: WebRTCOffer,
    current_user: Dict = Depends(auth_manager.require_auth)
):
    """Handle WebRTC offer for stream"""
    
    try:
        # Create peer connection
        connection_id = await webrtc_manager.create_peer_connection(current_user["user_id"])
        
        # Handle the offer
        answer = await webrtc_manager.handle_offer(connection_id, offer.dict())
        
        return {
            "connection_id": connection_id,
            "answer": answer
        }
        
    except Exception as e:
        logger.error(f"Error handling WebRTC offer: {e}")
        raise HTTPException(status_code=500, detail="Failed to process offer")

@api_router.post("/streams/{stream_id}/webrtc/{connection_id}/answer")
async def handle_webrtc_answer(
    stream_id: str,
    connection_id: str,
    answer: WebRTCAnswer,
    current_user: Dict = Depends(auth_manager.require_auth)
):
    """Handle WebRTC answer for connection"""
    
    try:
        await webrtc_manager.handle_answer(connection_id, answer.dict())
        return {"message": "Answer processed successfully"}
        
    except Exception as e:
        logger.error(f"Error handling WebRTC answer: {e}")
        raise HTTPException(status_code=500, detail="Failed to process answer")

@api_router.post("/streams/{stream_id}/webrtc/{connection_id}/ice-candidate")
async def handle_ice_candidate(
    stream_id: str,
    connection_id: str,
    candidate: ICECandidate,
    current_user: Dict = Depends(auth_manager.require_auth)
):
    """Handle ICE candidate for connection"""
    
    try:
        await webrtc_manager.handle_ice_candidate(connection_id, candidate.dict())
        return {"message": "ICE candidate processed successfully"}
        
    except Exception as e:
        logger.error(f"Error handling ICE candidate: {e}")
        raise HTTPException(status_code=500, detail="Failed to process ICE candidate")

@api_router.post("/streams/{stream_id}/start")
async def start_streaming(
    stream_id: str,
    connection_id: str = Form(...),
    current_user: Dict = Depends(auth_manager.require_model_status("approved"))
):
    """Start streaming for a stream"""
    
    try:
        success = await webrtc_manager.start_streaming(stream_id, connection_id)
        
        if success:
            # Update database
            await db.live_streams.update_one(
                {"stream_id": stream_id},
                {"$set": {"is_active": True, "started_at": datetime.now(timezone.utc)}}
            )
            
            # Notify WebSocket connections
            await websocket_manager.notify_stream_started(
                stream_id, 
                current_user["user_id"], 
                "Live Stream Started"
            )
            
            return {"message": "Streaming started successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to start streaming")
            
    except Exception as e:
        logger.error(f"Error starting stream: {e}")
        raise HTTPException(status_code=500, detail="Failed to start stream")

@api_router.post("/streams/{stream_id}/join")
async def join_stream(
    stream_id: str,
    connection_id: str = Form(...),
    current_user: Optional[Dict] = Depends(auth_manager.get_current_user)
):
    """Join stream as viewer"""
    
    try:
        # Check if user can access this stream
        stream_info = await webrtc_manager.get_stream_info(stream_id)
        if not stream_info:
            raise HTTPException(status_code=404, detail="Stream not found")
        
        # Check access permissions
        if current_user:
            can_access = auth_manager.validate_stream_access(
                current_user, 
                stream_info["stream_type"], 
                stream_info["streamer_id"]
            )
            if not can_access:
                raise HTTPException(status_code=403, detail="Stream access denied")
        else:
            # Anonymous users can only access public streams
            if stream_info["stream_type"] != "public":
                raise HTTPException(status_code=401, detail="Authentication required")
        
        # Join the stream
        success = await webrtc_manager.join_stream_as_viewer(stream_id, connection_id)
        
        if success:
            return {"message": "Joined stream successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to join stream")
            
    except Exception as e:
        logger.error(f"Error joining stream: {e}")
        raise HTTPException(status_code=500, detail="Failed to join stream")

# =====================
# TIP/PAYMENT ENDPOINTS FOR STREAMS
# =====================

@api_router.post("/streams/{stream_id}/tip")
async def send_tip(
    stream_id: str,
    tip_data: TipRequest,
    request: Request,
    current_user: Dict = Depends(auth_manager.require_auth)
):
    """Send tip to streamer during live stream"""
    
    # Verify stream exists and is active
    stream_info = await webrtc_manager.get_stream_info(stream_id)
    if not stream_info or not stream_info["is_active"]:
        raise HTTPException(status_code=404, detail="Stream not found or not active")
    
    # Validate tip amount (minimum $1, maximum $500)
    if tip_data.amount < 1.0 or tip_data.amount > 500.0:
        raise HTTPException(status_code=400, detail="Tip amount must be between $1 and $500")
    
    try:
        # Get Stripe API key
        stripe_api_key = os.environ.get('STRIPE_API_KEY')
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Payment system not configured")
        
        # Initialize Stripe checkout
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        # Create checkout session for tip
        success_url = f"{host_url}/tip-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{host_url}/streams/{stream_id}"
        
        checkout_request = CheckoutSessionRequest(
            amount=tip_data.amount,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "type": "tip",
                "stream_id": stream_id,
                "streamer_id": stream_info["streamer_id"],
                "tipper_id": current_user["user_id"],
                "message": tip_data.message or ""
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction = PaymentTransaction(
            session_id=session.session_id,
            amount=tip_data.amount,
            currency="usd",
            payment_status="pending",
            metadata={
                "type": "tip",
                "stream_id": stream_id,
                "streamer_id": stream_info["streamer_id"],
                "tipper_id": current_user["user_id"],
                "message": tip_data.message or ""
            }
        )
        
        await db.payment_transactions.insert_one(transaction.dict())
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "amount": tip_data.amount
        }
        
    except Exception as e:
        logger.error(f"Error creating tip checkout: {e}")
        raise HTTPException(status_code=500, detail="Failed to create tip checkout")

# =====================
# WEBSOCKET ENDPOINT
# =====================

@app.websocket("/ws/stream/{stream_id}")
async def websocket_stream_endpoint(websocket: WebSocket, stream_id: str):
    """WebSocket endpoint for stream signaling and chat"""
    
    connection_id = None
    try:
        # For now, we'll accept anonymous connections
        # In production, you'd want to authenticate via query params or headers
        user_id = f"anonymous_{uuid.uuid4().hex[:8]}"
        
        # Connect to WebSocket manager
        connection_id = await websocket_manager.connect(websocket, user_id)
        
        # Join stream room
        await websocket_manager.join_stream_room(connection_id, stream_id)
        
        # Listen for messages
        while True:
            try:
                data = await websocket.receive_text()
                await websocket_manager.handle_message(connection_id, data)
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket message error: {e}")
                break
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        if connection_id:
            await websocket_manager.disconnect(connection_id)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()