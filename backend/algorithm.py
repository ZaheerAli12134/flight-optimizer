import itertools
import time
import threading
from typing import List, Dict, Tuple, Any
import requests
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from backend.iata_lookup import iata_lookup
from collections import deque

load_dotenv()

class RateLimiter:
    def __init__(self, max_requests: int = 10, time_window: float = 1.0):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = deque()
        self.lock = threading.Lock()
    
    def wait_if_needed(self):
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
        self.rapidapi_key = os.getenv('RAPIDAPI_KEY')
        self.base_url = "https://google-flights2.p.rapidapi.com"
        self.adults = adults
        self.children = children
        self.infants = infants
        self.price_cache = {}
        self.iata_cache = {}
        self.rate_limiter = RateLimiter(max_requests=10, time_window=1.0)

    def _get_iata_code(self, city_name: str) -> str:
        cache_key = city_name.lower()
        
        if cache_key in self.iata_cache:
            return self.iata_cache[cache_key]
        
        try:
            iata_code = iata_lookup.get_iata_code(city_name)
            if iata_code:
                self.iata_cache[cache_key] = iata_code
                return iata_code
        except Exception:
            pass
        
        fallback_code = city_name[:3].upper()
        self.iata_cache[cache_key] = fallback_code
        return fallback_code

    def _get_flight_price(self, from_city: str, to_city: str, date: str) -> float:
        cache_key = f"{from_city}_{to_city}_{date}"
        if cache_key in self.price_cache:
            return self.price_cache[cache_key]
        
        try:
            self.rate_limiter.wait_if_needed()
            
            headers = {
                "X-RapidAPI-Key": self.rapidapi_key,
                "X-RapidAPI-Host": "google-flights2.p.rapidapi.com"
            }
            
            from_iata = self._get_iata_code(from_city)
            to_iata = self._get_iata_code(to_city)
            
            params = {
                "departure_id": from_iata,
                "arrival_id": to_iata,
                "outbound_date": date,
                "currency": "GBP",
                "adults": str(self.adults)
            }
            
            if self.children > 0:
                params["children"] = str(self.children)
            if self.infants > 0:
                params["infants"] = str(self.infants)
            
            response = requests.get(
                f"{self.base_url}/api/v1/searchFlights",
                headers=headers,
                params=params,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                price = self._extract_price_from_response(data)
                if price is not None and price > 0:
                    self.price_cache[cache_key] = price
                    return price
            elif response.status_code == 429:
                time.sleep(2)
            
            return 0.0
            
        except Exception:
            return 0.0

    def _extract_price_from_response(self, data: Any) -> float:
        try:
            if not isinstance(data, dict):
                return None
                
            if data.get('status') is not True:
                return None
                
            if 'data' not in data or not isinstance(data['data'], dict):
                return None
                
            data_content = data['data']
            
            flight_arrays = []
            
            if 'itineraries' in data_content and isinstance(data_content['itineraries'], dict):
                itineraries = data_content['itineraries']
                for key in ['topFlights', 'otherFlights', 'bestFlights', 'cheapestFlights']:
                    if key in itineraries and isinstance(itineraries[key], list):
                        flight_arrays.append(itineraries[key])
            
            for key in ['topFlights', 'otherFlights', 'bestFlights', 'cheapestFlights']:
                if key in data_content and isinstance(data_content[key], list):
                    flight_arrays.append(data_content[key])
            
            all_prices = []
            
            for flights in flight_arrays:
                for flight in flights:
                    if not isinstance(flight, dict):
                        continue
                    price = flight.get('price')
                    if price is not None:
                        try:
                            price_float = float(price)
                            all_prices.append(price_float)
                        except (ValueError, TypeError):
                            continue
            
            if all_prices:
                return min(all_prices)
            
            direct_price = data_content.get('price')
            if direct_price is not None:
                try:
                    return float(direct_price)
                except (ValueError, TypeError):
                    pass
            
            return None
                    
        except Exception:
            return None

    def find_optimal_routes(self, start_city: str, end_city: str, 
                          middle_cities: List[Dict[str, Any]], 
                          start_date: str, end_date: str, num_results: int = 3) -> List[Dict]:
        if not start_city or not end_city:
            return []
        
        all_routes = []
        
        for perm in itertools.permutations(range(len(middle_cities))):
            route_cities = [start_city] + [middle_cities[i]['name'] for i in perm] + [end_city]
            route_days = [0] + [middle_cities[i]['days'] for i in perm] + [0]
            
            total_cost, individual_prices, flight_dates = self._calculate_route_cost_with_dates_and_prices(route_cities, route_days, start_date)
            
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
            return []
        
        all_routes.sort(key=lambda x: x['total_cost'])
        
        for route in all_routes[:num_results]:
            base_confidence = max(0.5, 1.0 - (route['total_cost'] / 5000))
            route['confidence'] = round(base_confidence, 2)
            route['recommendation'] = "Book now" if base_confidence > 0.7 else "Wait for better prices"
        
        return all_routes[:num_results]
    
    def _calculate_route_cost_with_dates_and_prices(self, route: List[str], days_per_city: List[int], start_date: str) -> Tuple[float, List[float], List[str]]:
        total_cost = 0
        individual_prices = []
        flight_dates = []
        current_date = datetime.strptime(start_date, "%Y-%m-%d")
        
        for i in range(len(route) - 1):
            from_city = route[i]
            to_city = route[i + 1]
            
            departure_date = current_date + timedelta(days=days_per_city[i])
            departure_date_str = departure_date.strftime("%Y-%m-%d")
            
            price = self._get_flight_price(from_city, to_city, departure_date_str)
            
            if price <= 0:
                return 0, [], []
            
            total_cost += price
            individual_prices.append(price)
            flight_dates.append(departure_date_str)
            
            current_date = departure_date
        
        return total_cost, individual_prices, flight_dates

    def test_connection(self):
        try:
            headers = {
                "X-RapidAPI-Key": self.rapidapi_key,
                "X-RapidAPI-Host": "google-flights2.p.rapidapi.com"
            }
            
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