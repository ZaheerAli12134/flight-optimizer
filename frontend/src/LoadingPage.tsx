import React from 'react';
import './LoadingPage.css';

interface LoadingPageProps {
  searchData: {
    startCity: string;
    endCity: string;
    middleCities: { name: string; days: number }[];
    totalDays: number;
    startDate: string;
    endDate: string;
    adults: number;
    children: number;
    infants: number;
  };
}

const LoadingPage: React.FC<LoadingPageProps> = ({ searchData }) => {
  return (
    <div className="loading-page">
      <header className="header">
        <div className="logo">Airplane</div>
      </header>
      
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2>Finding Optimal Routes...</h2>
        <p>We're searching for the best flight combinations across all your destinations.</p>
        
        <div className="search-details">
          <h3>Your Trip Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="label">Route:</span>
              <span className="value">
                {searchData.startCity} → 
                {searchData.middleCities.map(city => ` ${city.name} (${city.days}d) →`)}
                {searchData.endCity}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Dates:</span>
              <span className="value">{searchData.startDate} to {searchData.endDate}</span>
            </div>
            <div className="detail-item">
              <span className="label">Duration:</span>
              <span className="value">{searchData.totalDays} days</span>
            </div>
            <div className="detail-item">
              <span className="label">Passengers:</span>
              <span className="value">
                {searchData.adults} adult{searchData.adults > 1 ? 's' : ''}
                {searchData.children > 0 && `, ${searchData.children} child${searchData.children > 1 ? 'ren' : ''}`}
                {searchData.infants > 0 && `, ${searchData.infants} infant${searchData.infants > 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        </div>

        <div className="loading-tips">
          <h4>💡 What's happening:</h4>
          <ul>
            <li>Searching real-time flight prices</li>
            <li>Calculating optimal route combinations</li>
            <li>Comparing {searchData.middleCities.length > 0 ? 
              `${searchData.middleCities.length} middle cities` : 'direct routes'}</li>
            <li>Finding the cheapest overall itinerary</li>
          </ul>
          <p className="estimated-time">This may take 15-30 seconds depending on route complexity...</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;