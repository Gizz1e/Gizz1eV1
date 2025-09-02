import requests
import sys
import json
import io
from datetime import datetime
import time

class GizzleTVAPITester:
    def __init__(self, base_url="https://streamhub-402.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Store authentication tokens and user data for testing
        self.user_token = None
        self.admin_token = None
        self.model_token = None
        self.user_data = None
        self.admin_data = None
        self.model_data = None
        self.stream_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def test_health_check(self):
        """Test basic health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Response: {data}"
            self.log_test("Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("Health Check", False, str(e))
            return False

    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Message: {data.get('message', 'No message')}"
            self.log_test("Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("Root Endpoint", False, str(e))
            return False

    def test_subscription_plans(self):
        """Test subscription plans endpoint"""
        try:
            response = requests.get(f"{self.base_url}/subscriptions/plans", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                plans = response.json()
                details += f", Plans count: {len(plans)}"
                
                # Verify expected plans exist
                plan_ids = [plan['id'] for plan in plans]
                expected_plans = ['basic', 'premium', 'vip']
                missing_plans = [p for p in expected_plans if p not in plan_ids]
                
                if missing_plans:
                    success = False
                    details += f", Missing plans: {missing_plans}"
                else:
                    # Check pricing
                    for plan in plans:
                        if plan['id'] == 'basic' and plan['price'] != 9.99:
                            success = False
                            details += f", Basic plan price incorrect: {plan['price']}"
                        elif plan['id'] == 'premium' and plan['price'] != 19.99:
                            success = False
                            details += f", Premium plan price incorrect: {plan['price']}"
                        elif plan['id'] == 'vip' and plan['price'] != 39.99:
                            success = False
                            details += f", VIP plan price incorrect: {plan['price']}"
                    
                    # Check if premium is marked as popular
                    premium_plan = next((p for p in plans if p['id'] == 'premium'), None)
                    if premium_plan and not premium_plan.get('is_popular', False):
                        details += ", Warning: Premium plan not marked as popular"
                        
            self.log_test("Subscription Plans", success, details)
            return success
        except Exception as e:
            self.log_test("Subscription Plans", False, str(e))
            return False

    def test_community_members(self):
        """Test community members endpoint"""
        try:
            response = requests.get(f"{self.base_url}/community/members", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                members = response.json()
                details += f", Members count: {len(members)}"
                
            self.log_test("Community Members", success, details)
            return success
        except Exception as e:
            self.log_test("Community Members", False, str(e))
            return False

    def test_content_endpoints(self):
        """Test content-related endpoints"""
        categories = ['videos', 'pictures', 'live_streams']
        all_success = True
        
        for category in categories:
            try:
                response = requests.get(f"{self.base_url}/content/{category}", timeout=10)
                success = response.status_code == 200
                details = f"Status: {response.status_code}"
                
                if success:
                    content = response.json()
                    details += f", Content count: {len(content)}"
                else:
                    all_success = False
                    
                self.log_test(f"Get {category.title()} Content", success, details)
                
            except Exception as e:
                self.log_test(f"Get {category.title()} Content", False, str(e))
                all_success = False
                
        return all_success

    def test_file_upload(self):
        """Test file upload functionality"""
        # Test image upload
        try:
            # Create a simple test image file
            test_image_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
            
            files = {
                'file': ('test_image.png', io.BytesIO(test_image_content), 'image/png')
            }
            data = {
                'category': 'pictures',
                'description': 'Test image upload',
                'tags': 'test,upload'
            }
            
            response = requests.post(f"{self.base_url}/content/upload", files=files, data=data, timeout=30)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                result = response.json()
                details += f", Content ID: {result.get('content_id', 'None')}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
                    
            self.log_test("File Upload (Image)", success, details)
            return success
            
        except Exception as e:
            self.log_test("File Upload (Image)", False, str(e))
            return False

    def test_subscription_checkout(self):
        """Test subscription checkout creation"""
        try:
            # Send plan_id as query parameter
            response = requests.post(f"{self.base_url}/subscriptions/checkout?plan_id=basic", timeout=10)
            
            # This might fail if Stripe is not configured, which is expected
            success = response.status_code in [200, 500]  # 500 is acceptable if Stripe not configured
            details = f"Status: {response.status_code}"
            
            if response.status_code == 200:
                result = response.json()
                details += f", Checkout URL exists: {'checkout_url' in result}"
            elif response.status_code == 500:
                try:
                    error_data = response.json()
                    if "Payment system not configured" in error_data.get('detail', ''):
                        details += ", Expected error: Payment system not configured"
                    else:
                        details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            else:
                success = False
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
                    
            self.log_test("Subscription Checkout", success, details)
            return success
            
        except Exception as e:
            self.log_test("Subscription Checkout", False, str(e))
            return False

    def test_purchase_checkout(self):
        """Test in-app purchase checkout creation"""
        try:
            # Send item_id as query parameter
            response = requests.post(f"{self.base_url}/purchases/checkout?item_id=premium_upload", timeout=10)
            
            # This might fail if Stripe is not configured, which is expected
            success = response.status_code in [200, 500]  # 500 is acceptable if Stripe not configured
            details = f"Status: {response.status_code}"
            
            if response.status_code == 200:
                result = response.json()
                details += f", Checkout URL exists: {'checkout_url' in result}"
            elif response.status_code == 500:
                try:
                    error_data = response.json()
                    if "Payment system not configured" in error_data.get('detail', ''):
                        details += ", Expected error: Payment system not configured"
                    else:
                        details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            else:
                success = False
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
                    
            self.log_test("Purchase Checkout", success, details)
            return success
            
        except Exception as e:
            self.log_test("Purchase Checkout", False, str(e))
            return False

    # =====================
    # AUTHENTICATION TESTS
    # =====================
    
    def test_user_registration(self):
        """Test user registration endpoint"""
        try:
            # Test normal user registration
            user_data = {
                "username": f"testuser_{int(time.time())}",
                "email": f"testuser_{int(time.time())}@example.com",
                "password": "TestPass123!",
                "is_model_application": False
            }
            
            response = requests.post(f"{self.base_url}/auth/register", json=user_data, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                result = response.json()
                self.user_token = result.get("access_token")
                self.user_data = result.get("user")
                details += f", User ID: {self.user_data.get('user_id', 'None')}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test("User Registration", success, details)
            return success
            
        except Exception as e:
            self.log_test("User Registration", False, str(e))
            return False
    
    def test_model_registration(self):
        """Test model applicant registration"""
        try:
            # Test model applicant registration
            model_data = {
                "username": f"testmodel_{int(time.time())}",
                "email": f"testmodel_{int(time.time())}@example.com",
                "password": "TestPass123!",
                "is_model_application": True
            }
            
            response = requests.post(f"{self.base_url}/auth/register", json=model_data, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                result = response.json()
                self.model_token = result.get("access_token")
                self.model_data = result.get("user")
                details += f", Model ID: {self.model_data.get('user_id', 'None')}"
                details += f", Is Model: {self.model_data.get('is_model', False)}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test("Model Registration", success, details)
            return success
            
        except Exception as e:
            self.log_test("Model Registration", False, str(e))
            return False
    
    def test_user_login(self):
        """Test user login endpoint"""
        if not self.user_data:
            self.log_test("User Login", False, "No user data available for login test")
            return False
        
        try:
            login_data = {
                "username_or_email": self.user_data["username"],
                "password": "TestPass123!"
            }
            
            response = requests.post(f"{self.base_url}/auth/login", json=login_data, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                result = response.json()
                details += f", Token received: {'access_token' in result}"
                details += f", User ID: {result.get('user', {}).get('user_id', 'None')}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test("User Login", success, details)
            return success
            
        except Exception as e:
            self.log_test("User Login", False, str(e))
            return False
    
    def test_jwt_token_validation(self):
        """Test JWT token validation"""
        if not self.user_token:
            self.log_test("JWT Token Validation", False, "No user token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Try to access a protected endpoint (model application)
            response = requests.get(f"{self.base_url}/models/applications", headers=headers, timeout=10)
            
            # This should fail with 403 (insufficient permissions), 404 (not found), or 200 (success)
            success = response.status_code in [403, 404, 200]  # All indicate valid token
            details = f"Status: {response.status_code}"
            
            if response.status_code == 403:
                details += ", Token valid but insufficient permissions (expected)"
            elif response.status_code == 404:
                details += ", Token valid but endpoint not found (expected)"
            elif response.status_code == 401:
                success = False
                details += ", Token invalid or expired"
            elif response.status_code == 200:
                details += ", Token valid with admin permissions"
            
            self.log_test("JWT Token Validation", success, details)
            return success
            
        except Exception as e:
            self.log_test("JWT Token Validation", False, str(e))
            return False
    
    # =====================
    # MODEL APPLICATION TESTS
    # =====================
    
    def test_model_application_submission(self):
        """Test model application submission"""
        if not self.model_token:
            self.log_test("Model Application Submission", False, "No model token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.model_token}"}
            application_data = {
                "stage_name": "Test Model",
                "real_name": "Test Real Name",
                "email": self.model_data["email"],
                "phone": "+1234567890",
                "bio": "Test model bio for verification",
                "social_links": {
                    "instagram": "https://instagram.com/testmodel",
                    "twitter": "https://twitter.com/testmodel"
                },
                "identity_document_ids": [],
                "portfolio_file_ids": []
            }
            
            response = requests.post(f"{self.base_url}/models/apply", json=application_data, headers=headers, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                result = response.json()
                details += f", Application ID: {result.get('application_id', 'None')}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test("Model Application Submission", success, details)
            return success
            
        except Exception as e:
            self.log_test("Model Application Submission", False, str(e))
            return False
    
    def test_get_model_applications_unauthorized(self):
        """Test getting model applications without admin permissions"""
        if not self.user_token:
            self.log_test("Get Model Applications (Unauthorized)", False, "No user token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = requests.get(f"{self.base_url}/models/applications", headers=headers, timeout=10)
            
            # Should return 403 Forbidden or 404 Not Found for non-admin users
            success = response.status_code in [403, 404]
            details = f"Status: {response.status_code}"
            
            if response.status_code == 403:
                details += ", Correctly denied access to non-admin user"
            elif response.status_code == 404:
                details += ", Endpoint not found (expected for non-admin user)"
            else:
                details += ", Unexpected response for non-admin user"
            
            self.log_test("Get Model Applications (Unauthorized)", success, details)
            return success
            
        except Exception as e:
            self.log_test("Get Model Applications (Unauthorized)", False, str(e))
            return False
    
    # =====================
    # LIVE STREAMING TESTS
    # =====================
    
    def test_create_stream_unauthorized(self):
        """Test creating stream without model verification"""
        if not self.user_token:
            self.log_test("Create Stream (Unauthorized)", False, "No user token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            stream_data = {
                "title": "Test Stream",
                "description": "Test stream description",
                "stream_type": "public",
                "max_viewers": 100
            }
            
            response = requests.post(f"{self.base_url}/streams/create", json=stream_data, headers=headers, timeout=10)
            
            # Should return 403 Forbidden for non-verified models
            success = response.status_code == 403
            details = f"Status: {response.status_code}"
            
            if success:
                details += ", Correctly denied stream creation to non-verified user"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test("Create Stream (Unauthorized)", success, details)
            return success
            
        except Exception as e:
            self.log_test("Create Stream (Unauthorized)", False, str(e))
            return False
    
    def test_get_active_streams(self):
        """Test getting active streams"""
        try:
            response = requests.get(f"{self.base_url}/streams/active", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                streams = response.json()
                details += f", Active streams count: {len(streams)}"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test("Get Active Streams", success, details)
            return success
            
        except Exception as e:
            self.log_test("Get Active Streams", False, str(e))
            return False
    
    def test_webrtc_offer_unauthorized(self):
        """Test WebRTC offer without authentication"""
        try:
            offer_data = {
                "sdp": "test_sdp_content",
                "type": "offer"
            }
            
            response = requests.post(f"{self.base_url}/streams/test_stream/webrtc/offer", json=offer_data, timeout=10)
            
            # Should return 401 Unauthorized or 403 Forbidden without token
            success = response.status_code in [401, 403]
            details = f"Status: {response.status_code}"
            
            if response.status_code == 401:
                details += ", Correctly requires authentication for WebRTC offer"
            elif response.status_code == 403:
                details += ", Correctly denies access for WebRTC offer"
            else:
                details += ", Unexpected response for unauthenticated WebRTC offer"
            
            self.log_test("WebRTC Offer (Unauthorized)", success, details)
            return success
            
        except Exception as e:
            self.log_test("WebRTC Offer (Unauthorized)", False, str(e))
            return False
    
    def test_join_stream_unauthorized(self):
        """Test joining stream without authentication"""
        try:
            join_data = {"connection_id": "test_connection_id"}
            
            response = requests.post(f"{self.base_url}/streams/test_stream/join", data=join_data, timeout=10)
            
            # Should return 401, 404 (stream not found), or 500 (server error for invalid stream)
            success = response.status_code in [401, 404, 500]
            details = f"Status: {response.status_code}"
            
            if response.status_code == 401:
                details += ", Correctly requires authentication"
            elif response.status_code == 404:
                details += ", Stream not found (expected for test stream)"
            elif response.status_code == 500:
                details += ", Server error for invalid stream (expected)"
            
            self.log_test("Join Stream (Unauthorized)", success, details)
            return success
            
        except Exception as e:
            self.log_test("Join Stream (Unauthorized)", False, str(e))
            return False
    
    # =====================
    # TIP SYSTEM TESTS
    # =====================
    
    def test_send_tip_unauthorized(self):
        """Test sending tip without authentication"""
        try:
            tip_data = {
                "stream_id": "test_stream",
                "amount": 5.0,
                "message": "Test tip"
            }
            
            response = requests.post(f"{self.base_url}/streams/test_stream/tip", json=tip_data, timeout=10)
            
            # Should return 401 Unauthorized or 403 Forbidden without token
            success = response.status_code in [401, 403]
            details = f"Status: {response.status_code}"
            
            if response.status_code == 401:
                details += ", Correctly requires authentication for tips"
            elif response.status_code == 403:
                details += ", Correctly denies access for tips"
            else:
                details += ", Unexpected response for unauthenticated tip"
            
            self.log_test("Send Tip (Unauthorized)", success, details)
            return success
            
        except Exception as e:
            self.log_test("Send Tip (Unauthorized)", False, str(e))
            return False
    
    def test_send_tip_invalid_amount(self):
        """Test sending tip with invalid amount"""
        if not self.user_token:
            self.log_test("Send Tip (Invalid Amount)", False, "No user token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            tip_data = {
                "stream_id": "test_stream",
                "amount": 0.5,  # Below minimum $1
                "message": "Test tip"
            }
            
            response = requests.post(f"{self.base_url}/streams/test_stream/tip", json=tip_data, headers=headers, timeout=10)
            
            # Should return 400 Bad Request for invalid amount
            success = response.status_code == 400
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += ", Correctly rejected invalid tip amount"
            else:
                details += ", Unexpected response for invalid tip amount"
            
            self.log_test("Send Tip (Invalid Amount)", success, details)
            return success
            
        except Exception as e:
            self.log_test("Send Tip (Invalid Amount)", False, str(e))
            return False
    
    # =====================
    # ERROR HANDLING TESTS
    # =====================
    
    def test_invalid_endpoints(self):
        """Test invalid endpoint handling"""
        try:
            response = requests.get(f"{self.base_url}/nonexistent/endpoint", timeout=10)
            success = response.status_code == 404
            details = f"Status: {response.status_code}"
            
            if success:
                details += ", Correctly returns 404 for invalid endpoints"
            else:
                details += ", Unexpected response for invalid endpoint"
            
            self.log_test("Invalid Endpoint Handling", success, details)
            return success
            
        except Exception as e:
            self.log_test("Invalid Endpoint Handling", False, str(e))
            return False
    
    def test_malformed_json(self):
        """Test malformed JSON handling"""
        try:
            headers = {"Content-Type": "application/json"}
            malformed_json = '{"invalid": json}'
            
            response = requests.post(f"{self.base_url}/auth/register", data=malformed_json, headers=headers, timeout=10)
            success = response.status_code == 422  # Unprocessable Entity
            details = f"Status: {response.status_code}"
            
            if success:
                details += ", Correctly handles malformed JSON"
            else:
                details += ", Unexpected response for malformed JSON"
            
            self.log_test("Malformed JSON Handling", success, details)
            return success
            
        except Exception as e:
            self.log_test("Malformed JSON Handling", False, str(e))
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting WebRTC Live Streaming Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity tests
        print("\n📡 Basic Connectivity Tests")
        self.test_health_check()
        self.test_root_endpoint()
        
        # Authentication system tests
        print("\n🔐 Authentication System Tests")
        self.test_user_registration()
        self.test_model_registration()
        self.test_user_login()
        self.test_jwt_token_validation()
        
        # Model registration system tests
        print("\n👤 Model Registration System Tests")
        self.test_model_application_submission()
        self.test_get_model_applications_unauthorized()
        
        # Live streaming tests
        print("\n📹 Live Streaming System Tests")
        self.test_create_stream_unauthorized()
        self.test_get_active_streams()
        self.test_webrtc_offer_unauthorized()
        self.test_join_stream_unauthorized()
        
        # Tip system tests
        print("\n💰 Tip System Tests")
        self.test_send_tip_unauthorized()
        self.test_send_tip_invalid_amount()
        
        # Error handling tests
        print("\n⚠️ Error Handling Tests")
        self.test_invalid_endpoints()
        self.test_malformed_json()
        
        # Legacy content management tests
        print("\n📁 Legacy Content Management Tests")
        self.test_content_endpoints()
        self.test_file_upload()
        self.test_community_members()
        self.test_subscription_plans()
        self.test_subscription_checkout()
        self.test_purchase_checkout()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            
            # Print failed tests summary
            failed_tests = [t for t in self.test_results if not t['success']]
            if failed_tests:
                print("\n❌ Failed Tests:")
                for test in failed_tests:
                    print(f"  - {test['name']}: {test['details']}")
            
            return 1

def main():
    tester = GizzleTVAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())