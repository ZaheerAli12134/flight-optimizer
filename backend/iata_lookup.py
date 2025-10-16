import csv
import os
import random
from typing import Dict, List, Optional

class IATALookup:
    def __init__(self, csv_file: str = "airports.csv"):
        self.airports: Dict[str, Dict] = {}
        self.city_to_airports: Dict[str, List[Dict]] = {}
        self.load_airports_data(csv_file)

    def load_airports_data(self, csv_file: str):
        if not os.path.exists(csv_file):
            raise FileNotFoundError(f"{csv_file} not found. Include it in your project folder.")

        with open(csv_file, encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 6:
                    airport_id, name, city, country, iata, icao = row[:6]
                    if iata and iata != "\\N" and len(iata) == 3:
                        airport_info = {
                            "name": name,
                            "city": city,
                            "country": country,
                            "iata": iata,
                            "icao": icao
                        }
                        self.airports[iata] = airport_info
                        city_key = city.lower().strip()
                        self.city_to_airports.setdefault(city_key, []).append(airport_info)

        print(f"✅ Loaded {len(self.airports)} airports with IATA codes")

    def get_airports_by_city(self, city_name: str) -> List[Dict]:
        """Get all airports for a specific city"""
        return self.city_to_airports.get(city_name.lower().strip(), [])
    
    def get_airport_by_iata(self, iata_code: str) -> Optional[Dict]:
        """Get airport info by IATA code"""
        return self.airports.get(iata_code.upper())

    def get_iata_code(self, input_text: str) -> str:
        """Get IATA code from either city name or airport code"""
        # If it's already a 3-letter uppercase code, return it
        if len(input_text) == 3 and input_text.isalpha() and input_text.isupper():
            # Verify it exists in our database
            if input_text in self.airports:
                return input_text
            else:
                print(f"⚠️ IATA code {input_text} not found in database, but using it anyway")
                return input_text
        
        # Try to find by city name
        iata_code = self.get_iata_for_city(input_text)
        if iata_code:
            return iata_code
        
        # Try direct lookup in airports dictionary (case-insensitive)
        input_upper = input_text.upper()
        if input_upper in self.airports:
            return input_upper
        
        # Try partial match in airport names or cities
        for iata, airport in self.airports.items():
            if (input_text.lower() in airport['name'].lower() or 
                input_text.lower() in airport['city'].lower()):
                return iata
        
        # Fallback - use first 3 letters
        return input_text[:3].upper()

    def get_iata_for_city(self, city_name: str, strategy: str = "largest") -> Optional[str]:
        """Get IATA code for a city using specified strategy"""
        city_name = city_name.lower().strip()
        airports = self.city_to_airports.get(city_name, [])
        if not airports:
            return None
        if len(airports) == 1:
            return airports[0]["iata"]
        if strategy == "first":
            return airports[0]["iata"]
        elif strategy == "random":
            return random.choice(airports)["iata"]
        elif strategy == "largest":
            # heuristic: prefer "International" airports
            sorted_airports = sorted(airports, key=lambda x: "international" in x["name"].lower(), reverse=True)
            return sorted_airports[0]["iata"]

    def search_airports(self, query: str, max_results: int = 7) -> List[str]:
        """Search airports by city name, airport name, or IATA code"""
        if not query or len(query) < 2:
            return []
        
        query_lower = query.lower().strip()
        suggestions = []
        
        # Search by city name
        for city_name, airports in self.city_to_airports.items():
            if query_lower in city_name:
                for airport in airports:
                    display_text = f"{airport['city']} ({airport['iata']}) - {airport['name']}"
                    if display_text not in suggestions:
                        suggestions.append(display_text)
        
        # Search by airport name and IATA code
        for airport in self.airports.values():
            if (query_lower in airport['name'].lower() or 
                query_lower in airport['iata'].lower()):
                display_text = f"{airport['city']} ({airport['iata']}) - {airport['name']}"
                if display_text not in suggestions:
                    suggestions.append(display_text)
        
        return suggestions[:max_results]

    def search_cities(self, query: str, limit: int = 5) -> List[str]:
        """Search cities and airports (for compatibility with flight_routes.py)"""
        return self.search_airports(query, max_results=limit)

    def get_all_cities(self) -> List[str]:
        """Get list of all unique cities"""
        return list(self.city_to_airports.keys())

    def get_airports_by_country(self, country: str) -> List[Dict]:
        """Get all airports in a specific country"""
        country_lower = country.lower().strip()
        return [airport for airport in self.airports.values() 
                if airport['country'].lower() == country_lower]

    def get_airport_count(self) -> int:
        """Get total number of airports loaded"""
        return len(self.airports)

    def get_city_count(self) -> int:
        """Get total number of unique cities"""
        return len(self.city_to_airports)

# Create a global instance
iata_lookup = IATALookup()