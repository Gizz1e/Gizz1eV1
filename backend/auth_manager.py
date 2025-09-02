from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List, Any
import bcrypt
import secrets
import hashlib
import logging
from pydantic import BaseModel
import re

logger = logging.getLogger(__name__)

class UserRole(BaseModel):
    role: str
    permissions: List[str]

class User(BaseModel):
    user_id: str
    username: str
    email: str
    roles: List[str]
    is_verified: bool = False
    is_model: bool = False
    model_verification_status: str = "none"  # none, pending, approved, rejected
    subscription_tier: str = "free"  # free, premium, vip
    created_at: datetime
    last_login: Optional[datetime] = None

class ModelApplication(BaseModel):
    application_id: str
    user_id: str
    stage_name: str
    real_name: str
    email: str
    phone: Optional[str] = None
    bio: str
    social_links: Dict[str, str]
    identity_documents: List[str]  # File IDs for uploaded documents
    portfolio_files: List[str]  # File IDs for portfolio
    application_date: datetime
    status: str = "pending"  # pending, under_review, approved, rejected
    admin_notes: Optional[str] = None
    review_date: Optional[datetime] = None

class AuthManager:
    def __init__(self):
        self.secret_key = secrets.token_urlsafe(32)
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 60
        self.refresh_token_expire_days = 30
        self.security = HTTPBearer(auto_error=False)
        
        # Define role permissions
        self.role_permissions = {
            "admin": [
                "manage_users",
                "verify_models", 
                "manage_streams",
                "view_analytics",
                "moderate_content",
                "access_admin_panel"
            ],
            "model": [
                "create_streams",
                "receive_tips",
                "access_private_streams",
                "upload_premium_content",
                "view_earnings"
            ],
            "premium_user": [
                "access_premium_streams",
                "send_tips",
                "upload_large_files",
                "priority_chat"
            ],
            "user": [
                "view_public_streams",
                "send_chat_messages",
                "upload_basic_files"
            ]
        }
    
    def hash_password(self, password: str) -> str:
        """Securely hash password"""
        # Validate password strength
        if not self.validate_password_strength(password):
            raise ValueError("Password does not meet security requirements")
        
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False
    
    def validate_password_strength(self, password: str) -> bool:
        """Validate password meets security requirements"""
        if len(password) < 8:
            return False
        
        # Check for at least one uppercase, lowercase, digit, and special char
        patterns = [
            r'[A-Z]',  # uppercase
            r'[a-z]',  # lowercase  
            r'\d',     # digit
            r'[!@#$%^&*(),.?":{}|<>]'  # special char
        ]
        
        for pattern in patterns:
            if not re.search(pattern, password):
                return False
        
        return True
    
    def validate_email(self, email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    def create_access_token(self, data: Dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access"
        })
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def create_refresh_token(self, user_id: str) -> str:
        """Create JWT refresh token"""
        expire = datetime.now(timezone.utc) + timedelta(days=self.refresh_token_expire_days)
        
        to_encode = {
            "user_id": user_id,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh"
        }
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str, token_type: str = "access") -> Dict:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            if payload.get("type") != token_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type"
                )
            
            return payload
            
        except JWTError as e:
            logger.error(f"Token verification failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    async def get_current_user(
        self, 
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
    ) -> Optional[Dict]:
        """Get current user from token (optional)"""
        if not credentials:
            return None
        
        try:
            payload = self.verify_token(credentials.credentials)
            return payload
        except HTTPException:
            return None
    
    async def require_auth(
        self, 
        credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
    ) -> Dict:
        """Require valid authentication"""
        payload = self.verify_token(credentials.credentials)
        return payload
    
    def require_roles(self, required_roles: List[str]):
        """Dependency to require specific roles"""
        async def role_checker(current_user: Dict = Depends(self.require_auth)):
            user_roles = current_user.get("roles", [])
            
            if not any(role in user_roles for role in required_roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            
            return current_user
        
        return role_checker
    
    def require_permissions(self, required_permissions: List[str]):
        """Dependency to require specific permissions"""
        async def permission_checker(current_user: Dict = Depends(self.require_auth)):
            user_roles = current_user.get("roles", [])
            user_permissions = set()
            
            # Collect all permissions from user roles
            for role in user_roles:
                if role in self.role_permissions:
                    user_permissions.update(self.role_permissions[role])
            
            # Check if user has all required permissions
            if not all(perm in user_permissions for perm in required_permissions):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            
            return current_user
        
        return permission_checker
    
    def require_model_status(self, required_status: str = "approved"):
        """Dependency to require specific model verification status"""
        async def model_status_checker(current_user: Dict = Depends(self.require_auth)):
            if not current_user.get("is_model", False):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Model account required"
                )
            
            model_status = current_user.get("model_verification_status", "none")
            if model_status != required_status:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Model verification status '{required_status}' required"
                )
            
            return current_user
        
        return model_status_checker
    
    def require_subscription_tier(self, required_tiers: List[str]):
        """Dependency to require specific subscription tier"""
        async def subscription_checker(current_user: Dict = Depends(self.require_auth)):
            user_tier = current_user.get("subscription_tier", "free")
            
            if user_tier not in required_tiers:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Subscription tier {required_tiers} required"
                )
            
            return current_user
        
        return subscription_checker
    
    async def create_user_account(
        self, 
        username: str, 
        email: str, 
        password: str, 
        is_model_application: bool = False
    ) -> Dict:
        """Create new user account"""
        
        # Validate inputs
        if not self.validate_email(email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format"
            )
        
        if not self.validate_password_strength(password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password does not meet security requirements"
            )
        
        # Generate user ID
        user_id = secrets.token_urlsafe(16)
        
        # Hash password
        hashed_password = self.hash_password(password)
        
        # Determine initial roles
        initial_roles = ["user"]
        if is_model_application:
            initial_roles.append("model")
        
        user_data = {
            "user_id": user_id,
            "username": username,
            "email": email,
            "password_hash": hashed_password,
            "roles": initial_roles,
            "is_verified": False,
            "is_model": is_model_application,
            "model_verification_status": "pending" if is_model_application else "none",
            "subscription_tier": "free",
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        }
        
        return user_data
    
    async def authenticate_user(self, username_or_email: str, password: str, db) -> Optional[Dict]:
        """Authenticate user credentials"""
        try:
            # Find user by username or email
            user = await db.users.find_one({
                "$or": [
                    {"username": username_or_email},
                    {"email": username_or_email}
                ]
            })
            
            if not user:
                return None
            
            # Verify password
            if not self.verify_password(password, user["password_hash"]):
                return None
            
            # Update last login
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"last_login": datetime.now(timezone.utc)}}
            )
            
            # Remove password hash from returned data
            user.pop("password_hash", None)
            return user
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return None
    
    async def create_model_application(
        self,
        user_id: str,
        stage_name: str,
        real_name: str,
        email: str,
        bio: str,
        social_links: Dict[str, str],
        identity_documents: List[str],
        portfolio_files: List[str],
        phone: Optional[str] = None
    ) -> ModelApplication:
        """Create model verification application"""
        
        application = ModelApplication(
            application_id=secrets.token_urlsafe(16),
            user_id=user_id,
            stage_name=stage_name,
            real_name=real_name,
            email=email,
            phone=phone,
            bio=bio,
            social_links=social_links,
            identity_documents=identity_documents,
            portfolio_files=portfolio_files,
            application_date=datetime.now(timezone.utc)
        )
        
        return application
    
    def generate_stream_access_token(
        self, 
        user_id: str, 
        stream_id: str, 
        permissions: List[str],
        expires_minutes: int = 60
    ) -> str:
        """Generate temporary stream access token"""
        
        data = {
            "user_id": user_id,
            "stream_id": stream_id,
            "permissions": permissions,
            "type": "stream_access"
        }
        
        expires_delta = timedelta(minutes=expires_minutes)
        return self.create_access_token(data, expires_delta)
    
    def validate_stream_access(
        self, 
        user: Dict, 
        stream_type: str, 
        streamer_id: str
    ) -> bool:
        """Validate if user can access stream"""
        
        user_roles = user.get("roles", [])
        subscription_tier = user.get("subscription_tier", "free")
        
        # Admins can access everything
        if "admin" in user_roles:
            return True
        
        # Stream owner can always access their own stream
        if user.get("user_id") == streamer_id:
            return True
        
        # Check stream type access
        if stream_type == "public":
            return True
        elif stream_type == "private":
            # Private streams require premium subscription or model status
            return (subscription_tier in ["premium", "vip"] or 
                    "model" in user_roles)
        elif stream_type == "premium":
            # Premium streams require premium/vip subscription
            return subscription_tier in ["premium", "vip"]
        
        return False
    
    def get_user_permissions(self, user_roles: List[str]) -> Set[str]:
        """Get all permissions for user roles"""
        permissions = set()
        
        for role in user_roles:
            if role in self.role_permissions:
                permissions.update(self.role_permissions[role])
        
        return permissions
    
    async def refresh_access_token(self, refresh_token: str) -> Dict:
        """Create new access token from refresh token"""
        try:
            payload = self.verify_token(refresh_token, token_type="refresh")
            user_id = payload.get("user_id")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
            
            # Create new access token (in real app, fetch user from DB)
            new_token_data = {
                "user_id": user_id,
                "type": "access"
            }
            
            new_access_token = self.create_access_token(new_token_data)
            
            return {
                "access_token": new_access_token,
                "token_type": "bearer"
            }
            
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

# Global auth manager instance
auth_manager = AuthManager()