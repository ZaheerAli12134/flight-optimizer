import React, { useState } from 'react';
import './ResultsPage.css';
import FlightDetailsPage from './FlightDetailsPage';

interface CityWithDays {
  name: string;
  days: number;
}

interface SearchData {
  startCity: string;
  endCity: string;
  middleCities: CityWithDays[];
  totalDays: number;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  infants: number;
  apiResults?: any;
}

interface Itinerary {
  route: string[];
  days_per_city: number[];
  total_cost: number;
  num_flights?: number;
  individual_prices?: number[];
  flight_dates?: string[];
  start_city?: string;
  end_city?: string;
  total_days?: number;
}

interface FlightLeg {
  from: string;
  to: string;
  date: string;
  price: number;
}

interface FlightDetailsData {
  route: string[];
  days_per_city: number[];
  total_cost: number;
  flightLegs: FlightLeg[];
  passengers: {
    adults: number;
    children: number;
    infants: number;
  };
}

interface ResultsPageProps {
  searchData: SearchData;
  onNewSearch: () => void;
}

const ResultsPage: React.FC<ResultsPageProps> = ({ searchData, onNewSearch }) => {
  const getResultsArray = (): Itinerary[] => {
    if (!searchData.apiResults) return [];
    
    if (Array.isArray(searchData.apiResults)) {
      return searchData.apiResults;
    }
    
    if (searchData.apiResults.routes && Array.isArray(searchData.apiResults.routes)) {
      return searchData.apiResults.routes;
    }
    
    if (searchData.apiResults.data && Array.isArray(searchData.apiResults.data)) {
      return searchData.apiResults.data;
    }
    
    return [];
  };

  const results: Itinerary[] = getResultsArray();
  const [selectedFlightData, setSelectedFlightData] = useState<FlightDetailsData | null>(null);

  const handleSelectRoute = (itinerary: Itinerary) => {
    const flightLegs: FlightLeg[] = [];
    
    for (let i = 0; i < itinerary.route.length - 1; i++) {
      const fromCity = itinerary.route[i];
      const toCity = itinerary.route[i + 1];
      
      const actualPrice = itinerary.individual_prices?.[i] || itinerary.total_cost / (itinerary.route.length - 1);
      const actualDate = itinerary.flight_dates?.[i] || calculateDate(searchData.startDate, itinerary.days_per_city, i);
      
      flightLegs.push({
        from: fromCity,
        to: toCity,
        date: actualDate,
        price: Math.round(actualPrice * 100) / 100
      });
    }
    
    const flightData: FlightDetailsData = {
      route: itinerary.route,
      days_per_city: itinerary.days_per_city,
      total_cost: itinerary.total_cost,
      flightLegs: flightLegs,
      passengers: {
        adults: searchData.adults,
        children: searchData.children,
        infants: searchData.infants
      }
    };
    
    setSelectedFlightData(flightData);
  };

  const calculateDate = (startDate: string, daysPerCity: number[], legIndex: number) => {
    const date = new Date(startDate);
    let totalDays = 0;
    
    for (let i = 0; i <= legIndex; i++) {
      totalDays += daysPerCity[i] || 0;
    }
    
    date.setDate(date.getDate() + totalDays);
    return date.toISOString().split('T')[0];
  };

  const handleBackFromDetails = () => {
    setSelectedFlightData(null);
  };

  if (selectedFlightData) {
    return <FlightDetailsPage flightData={selectedFlightData} onBack={handleBackFromDetails} />;
  }

  if (results.length === 0) {
    return (
      <div className="results-page">
        <header className="header">
          <div className="logo">Airplane</div>
          <button className="new-search-btn" onClick={onNewSearch}>
            New Search
          </button>
        </header>
        <div className="results-container">
          <div className="no-results">
            <h2>No Routes Found</h2>
            <p>We couldn't find any routes matching your search criteria.</p>
            <button className="retry-btn" onClick={onNewSearch}>
              Try Different Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="results-page">
      <header className="header">
        <div className="logo">Airplane</div>
        <button className="new-search-btn" onClick={onNewSearch}>
          New Search
        </button>
      </header>

      <div className="results-container">
        <h2>Optimal Routes Found</h2>
        <p className="search-summary">
          {searchData.startCity} → {searchData.middleCities.length > 0 
            ? `${searchData.middleCities.map(c => c.name).join(' → ')} → ` 
            : ''}
          {searchData.endCity}
        </p>
        <p className="date-range">
          {searchData.startDate} to {searchData.endDate} • {searchData.totalDays} days • 
          {searchData.adults} adult{searchData.adults > 1 ? 's' : ''}
          {searchData.children > 0 ? `, ${searchData.children} child${searchData.children > 1 ? 'ren' : ''}` : ''}
          {searchData.infants > 0 ? `, ${searchData.infants} infant${searchData.infants > 1 ? 's' : ''}` : ''}
        </p>

        <div className="results-grid">
          {results.map((itinerary, index) => (
            <div key={index} className="itinerary-card">
              <div className="card-header">
                <h3>Option {index + 1}</h3>
              </div>

              <div className="route-display">
                <div className="route-path">
                  {itinerary.route.map((city, cityIndex) => (
                    <React.Fragment key={cityIndex}>
                      <span className="city">{city}</span>
                      {itinerary.days_per_city && itinerary.days_per_city[cityIndex] > 0 && (
                        <span className="days-badge">{itinerary.days_per_city[cityIndex]}d</span>
                      )}
                      {cityIndex < itinerary.route.length - 1 && (
                        <span className="arrow">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="itinerary-details">
                <div className="detail">
                  <span className="label">Total Cost:</span>
                  <span className="value cost">£{itinerary.total_cost.toFixed(2)}</span>
                </div>
                <div className="detail">
                  <span className="label">Flights:</span>
                  <span className="value">{itinerary.num_flights || itinerary.route.length - 1} flights</span>
                </div>
                <div className="detail">
                  <span className="label">Total Days:</span>
                  <span className="value">{itinerary.total_days || itinerary.days_per_city.reduce((sum, days) => sum + days, 0)} days</span>
                </div>
              </div>

              <div className="card-actions">
                <button 
                  className="select-btn primary" 
                  onClick={() => handleSelectRoute(itinerary)}
                >
                  View Flight Details
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="results-footer">
          <button className="secondary-search-btn" onClick={onNewSearch}>
            Start New Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;