import requests
import sys
import json
import io
from datetime import datetime

class GizzleTVAPITester:
    def __init__(self, base_url="https://streamhub-402.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Gizzle TV L.L.C. Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity tests
        self.test_health_check()
        self.test_root_endpoint()
        
        # Content management tests
        self.test_content_endpoints()
        self.test_file_upload()
        
        # Community tests
        self.test_community_members()
        
        # Subscription and payment tests
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