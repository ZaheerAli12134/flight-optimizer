import itertools
import time
import threading
from typing import List, Dict, Tuple, Any
import requests
from datetime import datetime, timedelta
from backend.config import RAPIDAPI_KEY
from backend.iata_lookup import iata_lookup
from collections import deque

class RateLimiter:
    """Rate limiter for RapidAPI"""
    def __init__(self, max_requests: int = 10, time_window: float = 1.0):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = deque()
        self.lock = threading.Lock()
    
    def wait_if_needed(self):
        """Wait if we've hit the rate limit"""
        with self.lock:
            now = time.time()
            while self.requests and self.requests[0] < now - self.time_window:
                self.requests.popleft()
            
            if len(self.requests) >= self.max_requests:
                sleep_time = self.requests[0] - (now - self.time_window)
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    while self.requests and self.requests[0] < time.time() - self.time_window:
                        self.requests.popleft()
            
            self.requests.append(now)

class RouteOptimizer:
    def __init__(self, adults: int = 1, children: int = 0, infants: int = 0):
        self.rapidapi_key = RAPIDAPI_KEY
        self.base_url = "https://google-flights2.p.rapidapi.com"
        self.adults = adults
        self.children = children
        self.infants = infants
        self.price_cache = {}
        self.iata_cache = {}
        self.rate_limiter = RateLimiter(max_requests=10, time_window=1.0)

    def _get_iata_code(self, city_name: str) -> str:
        """Get IATA code using the improved lookup"""
        cache_key = city_name.lower()
        
        if cache_key in self.iata_cache:
            return self.iata_cache[cache_key]
        
        try:
            # Use the new method that handles both city names and airport codes
            iata_code = iata_lookup.get_iata_code(city_name)
            if iata_code:
                print(f"✅ IATA Lookup: {city_name} → {iata_code}")
                self.iata_cache[cache_key] = iata_code
                return iata_code
            else:
                print(f"❌ No IATA code found for {city_name}")
        except Exception as e:
            print(f"❌ Error getting IATA code for {city_name}: {e}")
        
        # Final fallback
        fallback_code = city_name[:3].upper()
        print(f"⚠️ Using emergency fallback: {city_name} → {fallback_code}")
        self.iata_cache[cache_key] = fallback_code
        return fallback_code

    def _get_flight_price(self, from_city: str, to_city: str, date: str) -> float:
        """Get flight price from Google Flights API"""
        cache_key = f"{from_city}_{to_city}_{date}"
        if cache_key in self.price_cache:
            return self.price_cache[cache_key]
        
        try:
            self.rate_limiter.wait_if_needed()
            
            headers = {
                "X-RapidAPI-Key": self.rapidapi_key,
                "X-RapidAPI-Host": "google-flights2.p.rapidapi.com"
            }
            
            # Convert city names to IATA codes using improved lookup
            from_iata = self._get_iata_code(from_city)
            to_iata = self._get_iata_code(to_city)
            
            params = {
                "departure_id": from_iata,
                "arrival_id": to_iata,
                "outbound_date": date,
                "currency": "GBP",
                "adults": str(self.adults)
            }
            
            # Add children and infants if present
            if self.children > 0:
                params["children"] = str(self.children)
            if self.infants > 0:
                params["infants"] = str(self.infants)
            
            print(f"🔍 Google Flights API: {from_city}({from_iata}) → {to_city}({to_iata}) on {date}")
            
            response = requests.get(
                f"{self.base_url}/api/v1/searchFlights",
                headers=headers,
                params=params,
                timeout=15
            )
            
            print(f"Google Flights API Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                price = self._extract_price_from_response(data)
                if price is not None and price > 0:
                    print(f"✅ Google Flights: {from_city} → {to_city} on {date} = £{price}")
                    self.price_cache[cache_key] = price
                    return price
                else:
                    print(f"❌ No flights found for {from_city} → {to_city} on {date}")
            elif response.status_code == 404:
                print(f"❌ Endpoint not found: /api/v1/searchFlights")
            elif response.status_code == 429:
                print("⚠️ Rate limit hit! Waiting 2 seconds...")
                time.sleep(2)
            else:
                print(f"❌ API Error {response.status_code}: {response.text[:200]}")
            
            return 0.0
            
        except Exception as e:
            print(f"❌ Google Flights API error for {from_city} → {to_city}: {e}")
            return 0.0

    def _extract_price_from_response(self, data: Any) -> float:
        """Extract price from the Google Flights API response with proper type handling"""
        try:
            print(f"🔍 Starting price extraction...")
            
            if not isinstance(data, dict):
                print(f"❌ Data is not a dictionary")
                return None
                
            if data.get('status') is not True:
                print(f"❌ API status is not True: {data.get('status')}")
                return None
                
            if 'data' not in data or not isinstance(data['data'], dict):
                print(f"❌ No data field or data is not a dictionary")
                return None
                
            data_content = data['data']
            print(f"📊 Data content keys: {list(data_content.keys())}")
            
            # Check all possible flight arrays in the response
            flight_arrays = []
            
            # Check nested itineraries
            if 'itineraries' in data_content and isinstance(data_content['itineraries'], dict):
                itineraries = data_content['itineraries']
                print(f"📊 Itineraries keys: {list(itineraries.keys())}")
                
                for key in ['topFlights', 'otherFlights', 'bestFlights', 'cheapestFlights']:
                    if key in itineraries and isinstance(itineraries[key], list):
                        flight_arrays.append((f"itineraries.{key}", itineraries[key]))
            
            # Check direct flight arrays
            for key in ['topFlights', 'otherFlights', 'bestFlights', 'cheapestFlights']:
                if key in data_content and isinstance(data_content[key], list):
                    flight_arrays.append((f"data.{key}", data_content[key]))
            
            print(f"🔍 Found {len(flight_arrays)} flight arrays to check")
            
            # Search through all flight arrays for prices
            all_prices = []
            
            for location, flights in flight_arrays:
                print(f"🔍 Checking {location} with {len(flights)} flights")
                
                for i, flight in enumerate(flights):
                    if not isinstance(flight, dict):
                        continue
                        
                    price = flight.get('price')
                    if price is not None:
                        try:
                            # Convert to float, handling both string and number types
                            price_float = float(price)
                            all_prices.append(price_float)
                            print(f"💰 Found price in {location}[{i}]: £{price_float}")
                        except (ValueError, TypeError) as e:
                            print(f"❌ Could not convert price '{price}' to float: {e}")
            
            # If we found prices, return the cheapest one
            if all_prices:
                cheapest_price = min(all_prices)
                print(f"✅ Cheapest price found: £{cheapest_price}")
                return cheapest_price
            
            # Check for direct price field as last resort
            direct_price = data_content.get('price')
            if direct_price is not None:
                try:
                    price_float = float(direct_price)
                    print(f"💰 Found direct price field: £{price_float}")
                    return price_float
                except (ValueError, TypeError) as e:
                    print(f"❌ Could not convert direct price '{direct_price}' to float: {e}")
            
            print(f"❌ No valid prices found in response")
            return None
                    
        except Exception as e:
            print(f"❌ Price extraction error: {e}")
            import traceback
            print(f"❌ Stack trace: {traceback.format_exc()}")
            return None

    def find_optimal_routes(self, start_city: str, end_city: str, 
                          middle_cities: List[Dict[str, Any]], 
                          start_date: str, end_date: str, num_results: int = 3) -> List[Dict]:
        """
        Find cheapest routes using flight data
        - Start city is always first
        - End city is always last  
        - Middle cities can be in any order
        - All permutations of middle cities are checked
        """
        if not start_city or not end_city:
            return []
        
        middle_city_names = [city['name'] for city in middle_cities]
        middle_city_days = [city['days'] for city in middle_cities]
        
        print(f"🔍 Finding routes from {start_city} to {end_city}")
        print(f"📍 Via: {middle_city_names} with days: {middle_city_days}")
        print(f"👥 Passengers: {self.adults} adults, {self.children} children, {self.infants} infants")
        print(f"📅 Date range: {start_date} to {end_date}")
        
        all_routes = []
        
        # Generate all possible orders for the middle cities
        for perm in itertools.permutations(range(len(middle_cities))):
            # Build route with cities and their days
            # Start city is always first, end city is always last
            route_cities = [start_city] + [middle_cities[i]['name'] for i in perm] + [end_city]
            route_days = [0] + [middle_cities[i]['days'] for i in perm] + [0]
            
            # Calculate dates for each flight leg AND get individual prices
            total_cost, individual_prices, flight_dates = self._calculate_route_cost_with_dates_and_prices(route_cities, route_days, start_date)
            
            # Only include routes where all flights are available
            if total_cost > 0 and all(price > 0 for price in individual_prices):
                all_routes.append({
                    'route': route_cities,
                    'days_per_city': route_days,
                    'total_cost': total_cost,
                    'individual_prices': individual_prices,
                    'flight_dates': flight_dates,
                    'num_flights': len(route_cities) - 1,
                    'start_city': start_city,
                    'end_city': end_city,
                    'total_days': sum(route_days)
                })
        
        if not all_routes:
            print("❌ No valid routes found with available flights")
            return []
        
        # Sort by cost and return top results
        all_routes.sort(key=lambda x: x['total_cost'])
        
        # Add confidence scores based on cost
        for route in all_routes[:num_results]:
            base_confidence = max(0.5, 1.0 - (route['total_cost'] / 5000))
            route['confidence'] = round(base_confidence, 2)
            route['recommendation'] = "Book now" if base_confidence > 0.7 else "Wait for better prices"
        
        print(f"✅ Found {len(all_routes[:num_results])} optimal routes")
        return all_routes[:num_results]
    
    def _calculate_route_cost_with_dates_and_prices(self, route: List[str], days_per_city: List[int], start_date: str) -> Tuple[float, List[float], List[str]]:
        """Calculate total flight cost using dates and API prices"""
        total_cost = 0
        individual_prices = []
        flight_dates = []
        current_date = datetime.strptime(start_date, "%Y-%m-%d")
        
        # Check flights between consecutive cities in the route
        # This checks ALL necessary flights for the given route order
        for i in range(len(route) - 1):
            from_city = route[i]
            to_city = route[i + 1]
            
            # Calculate departure date (after staying X days in current city)
            departure_date = current_date + timedelta(days=days_per_city[i])
            departure_date_str = departure_date.strftime("%Y-%m-%d")
            
            # Get flight price for this specific date
            price = self._get_flight_price(from_city, to_city, departure_date_str)
            
            # If any flight in the route is unavailable (price = 0), skip the entire route
            if price <= 0:
                return 0, [], []
            
            total_cost += price
            individual_prices.append(price)
            flight_dates.append(departure_date_str)
            
            # Move to next city (arrival date)
            current_date = departure_date
        
        return total_cost, individual_prices, flight_dates

    def test_connection(self):
        """Test if Google Flights API is working"""
        try:
            headers = {
                "X-RapidAPI-Key": self.rapidapi_key,
                "X-RapidAPI-Host": "google-flights2.p.rapidapi.com"
            }
            
            # Test with the correct endpoint
            params = {
                "departure_id": "LON",
                "arrival_id": "CDG",
                "outbound_date": "2024-06-01",
                "currency": "GBP",
                "adults": "1"
            }
            
            response = requests.get(
                f"{self.base_url}/api/v1/searchFlights",
                headers=headers,
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') is True:
                    price = self._extract_price_from_response(data)
                    return {
                        "status": "success",
                        "message": "API is working correctly with /api/v1/searchFlights endpoint",
                        "sample_price": price
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"API returned false status: {data.get('message')}"
                    }
            else:
                return {
                    "status": "error",
                    "status_code": response.status_code,
                    "message": response.text[:200]
                }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}