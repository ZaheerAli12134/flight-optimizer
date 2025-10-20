import React, { useState } from 'react';
import './FlightDetailsPage.css';

interface FlightLeg {
  from: string;
  to: string;
  date: string;
  price: number;
  airline?: string;
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  bookingLink?: string;
  deepLink?: string;
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

interface FlightDetailsPageProps {
  flightData: FlightDetailsData;
  onBack: () => void;
}

const FlightDetailsPage: React.FC<FlightDetailsPageProps> = ({ flightData, onBack }) => {
  const [bookingLinks, setBookingLinks] = useState<{[key: string]: string}>({});
  const [loadingBooking, setLoadingBooking] = useState<{[key: string]: boolean}>({});

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const generateBookingLink = async (from: string, to: string, date: string, legIndex: number): Promise<string> => {
    const bookingKey = `${from}-${to}-${date}`;
    
    if (bookingLinks[bookingKey]) {
      return bookingLinks[bookingKey];
    }

    setLoadingBooking(prev => ({ ...prev, [bookingKey]: true }));

    try {
      const response = await fetch('http://localhost:8000/api/generate-booking-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from,
          to: to,
          date: date,
          legIndex: legIndex
        })
      });

      if (response.ok) {
        const data = await response.json();
        const bookingUrl = data.booking_url;
        setBookingLinks(prev => ({ ...prev, [bookingKey]: bookingUrl }));
        return bookingUrl;
      }
    } catch (error) {
      console.error(`Error generating booking link for ${from}-${to}:`, error);
    } finally {
      setLoadingBooking(prev => ({ ...prev, [bookingKey]: false }));
    }

    const fallbackUrl = `https://www.google.com/travel/flights?q=Flights%20from%20${encodeURIComponent(from)}%20to%20${encodeURIComponent(to)}%20on%20${date}`;
    return fallbackUrl;
  };

  const getSkyscannerLink = (from: string, to: string, date: string) => {
    const formattedDate = date.replace(/-/g, '');
    return `https://www.skyscanner.net/transport/flights/${encodeURIComponent(from.toLowerCase())}/${encodeURIComponent(to.toLowerCase())}/${formattedDate}/?adults=${flightData.passengers.adults}&children=${flightData.passengers.children}&infants=${flightData.passengers.infants}&rtn=0`;
  };

  const hasApiBookingLink = (leg: FlightLeg) => {
    return leg.bookingLink || leg.deepLink;
  };

  const handleBookingClick = async (leg: FlightLeg, index: number) => {
    const bookingKey = `${leg.from}-${leg.to}-${leg.date}`;
    if (!bookingLinks[bookingKey] && !loadingBooking[bookingKey]) {
      const bookingUrl = await generateBookingLink(leg.from, leg.to, leg.date, index);
      window.open(bookingUrl, '_blank', 'noopener,noreferrer');
    } else if (bookingLinks[bookingKey]) {
      window.open(bookingLinks[bookingKey], '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flight-details-page">
      <header className="header">
        <div className="logo">Airplane</div>
        <button className="back-btn" onClick={onBack}>
          ← Back to Results
        </button>
      </header>

      <div className="details-container">
        <div className="route-header">
          <h2>Your Flight Itinerary</h2>
          <div className="route-summary">
            <div className="route-path">
              {flightData.route.map((city, index) => (
                <React.Fragment key={index}>
                  <span className="city">{city}</span>
                  {index < flightData.route.length - 1 && (
                    <span className="arrow">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="total-cost">
              Total: <strong>£{flightData.total_cost.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className="passenger-info">
          <h3>Passengers</h3>
          <div className="passenger-details">
            <span>{flightData.passengers.adults} Adult{flightData.passengers.adults > 1 ? 's' : ''}</span>
            {flightData.passengers.children > 0 && (
              <span>, {flightData.passengers.children} Child{flightData.passengers.children > 1 ? 'ren' : ''}</span>
            )}
            {flightData.passengers.infants > 0 && (
              <span>, {flightData.passengers.infants} Infant{flightData.passengers.infants > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        <div className="flight-legs">
          <h3>Flight Details</h3>
          {flightData.flightLegs.map((leg, index) => {
            const bookingKey = `${leg.from}-${leg.to}-${leg.date}`;
            const isBookingLoading = loadingBooking[bookingKey];
            
            return (
              <div key={index} className="flight-leg">
                <div className="leg-header">
                  <h4>Flight {index + 1}: {leg.from} → {leg.to}</h4>
                  <span className="leg-price">£{leg.price.toFixed(2)}</span>
                </div>
                
                <div className="leg-details">
                  <div className="detail">
                    <span className="label">Date:</span>
                    <span className="value">{formatDate(leg.date)}</span>
                  </div>
                  <div className="detail">
                    <span className="label">From:</span>
                    <span className="value">{leg.from}</span>
                  </div>
                  <div className="detail">
                    <span className="label">To:</span>
                    <span className="value">{leg.to}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Price:</span>
                    <span className="value">£{leg.price.toFixed(2)}</span>
                  </div>
                  {leg.airline && (
                    <div className="detail">
                      <span className="label">Airline:</span>
                      <span className="value">{leg.airline}</span>
                    </div>
                  )}
                </div>

                <div className="booking-section">
                  <div className="booking-options">
                    {hasApiBookingLink(leg) ? (
                      <>
                        <a 
                          href={leg.bookingLink || leg.deepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="book-btn google-btn primary"
                        >
                          ✈️ Book This Flight
                        </a>
                        <a 
                          href={getSkyscannerLink(leg.from, leg.to, leg.date)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="book-btn google-btn secondary"
                        >
                          🔍 Compare on Skyscanner
                        </a>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleBookingClick(leg, index)}
                          disabled={isBookingLoading}
                          className={`book-btn google-btn primary ${isBookingLoading ? 'loading' : ''}`}
                        >
                          {isBookingLoading ? '⏳ Generating...' : '✈️ Book This Flight'}
                        </button>
                        <a 
                          href={getSkyscannerLink(leg.from, leg.to, leg.date)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="book-btn google-btn secondary"
                        >
                          🔍 Search on Skyscanner
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="total-booking">
          <h3>Book Your Multi-City Trip</h3>
          <div className="booking-tips">
            <h4>Booking Options:</h4>
            <ul>
              <li>Book individually: Use the links above for each flight</li>
              <li>Use Google Flights multi-city: 
                <a 
                  href={`https://www.google.com/travel/flights?q=Multi-city%20flights`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-link"
                > Open Multi-City Search</a>
              </li>
              <li>Consider booking directly with airlines for better flexibility</li>
              <li>Allow 2-3 hours between flights for connections</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightDetailsPage;