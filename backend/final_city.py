from fastapi import APIRouter, HTTPException
from backend.iata_lookup import iata_lookup

router = APIRouter()

@router.get("/api/city-suggestions")
async def city_suggestions(query: str):
    """Get city/airport suggestions using the existing IATA lookup"""
    if not query or len(query) < 2:
        return {"suggestions": []}
    
    try:
        print(f"🔍 Backend searching for: '{query}'")
        print(f"📊 Total cities in lookup: {len(iata_lookup.city_to_airports)}")
        print(f"📊 Total airports in lookup: {len(iata_lookup.airports)}")
        
        # Use the search_airports method which now handles both city names and airport codes
        suggestions = iata_lookup.search_airports(query)
        
        print(f"✅ Found {len(suggestions)} suggestions for '{query}': {suggestions}")
        return {"suggestions": suggestions}
        
    except Exception as e:
        print(f"❌ Error in city suggestions: {e}")
        import traceback
        print(f"❌ Stack trace: {traceback.format_exc()}")
        return {"suggestions": []}