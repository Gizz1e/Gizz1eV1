from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, Request
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
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

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