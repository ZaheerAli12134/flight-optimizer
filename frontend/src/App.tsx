import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import ResultsPage from './ResultsPage';

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
  apiResults?: any[];
}

function App() {
  const [numberOfCities, setNumberOfCities] = useState(2);
  const [startCity, setStartCity] = useState('');
  const [endCity, setEndCity] = useState('');
  const [middleCities, setMiddleCities] = useState<CityWithDays[]>([]);
  const [totalDays, setTotalDays] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
     
  const [currentPage, setCurrentPage] = useState<'search' | 'results'>('search');
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [startCitySuggestions, setStartCitySuggestions] = useState<string[]>([]);
  const [endCitySuggestions, setEndCitySuggestions] = useState<string[]>([]);
  const [middleCitySuggestions, setMiddleCitySuggestions] = useState<string[][]>([[]]);
  
  const startCityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const endCityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const middleCityTimeoutRefs = useRef<{[key: number]: NodeJS.Timeout | null}>({});

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const fetchCitySuggestions = async (query: string): Promise<string[]> => {
    if (query.length < 2) return [];
    
    try {
      const response = await fetch(`${API_BASE}/api/city-suggestions?query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        return data.suggestions || [];
      }
    } catch (error) {
      console.error('Error fetching city suggestions:', error);
    }
    return [];
  };

  useEffect(() => {
    const middleCitiesCount = Math.max(0, numberOfCities - 2);
    if (middleCitiesCount > middleCities.length) {
      const newMiddleCities = [...middleCities];
      while (newMiddleCities.length < middleCitiesCount) {
        newMiddleCities.push({ name: '', days: 0 });
      }
      setMiddleCities(newMiddleCities);
      setMiddleCitySuggestions(prev => {
        const newSuggestions = [...prev];
        while (newSuggestions.length < middleCitiesCount) {
          newSuggestions.push([]);
        }
        return newSuggestions;
      });
    } else if (middleCitiesCount < middleCities.length) {
      setMiddleCities(middleCities.slice(0, middleCitiesCount));
      setMiddleCitySuggestions(prev => prev.slice(0, middleCitiesCount));
    }
  }, [numberOfCities, middleCities.length, middleCities]);
     
  useEffect(() => {
    const total = middleCities.reduce((sum, city) => sum + city.days, 0);
    setTotalDays(total);
    
    if (startDate && total > 0) {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(start.getDate() + total);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [middleCities, startDate]);

  const handleStartCityChange = async (value: string) => {
    setStartCity(value);
    
    if (startCityTimeoutRef.current) {
      clearTimeout(startCityTimeoutRef.current);
    }
    
    if (value.length < 2) {
      setStartCitySuggestions([]);
      return;
    }
    
    startCityTimeoutRef.current = setTimeout(async () => {
      const suggestions = await fetchCitySuggestions(value);
      setStartCitySuggestions(suggestions);
    }, 300);
  };

  const handleEndCityChange = async (value: string) => {
    setEndCity(value);
    
    if (endCityTimeoutRef.current) {
      clearTimeout(endCityTimeoutRef.current);
    }
    
    if (value.length < 2) {
      setEndCitySuggestions([]);
      return;
    }
    
    endCityTimeoutRef.current = setTimeout(async () => {
      const suggestions = await fetchCitySuggestions(value);
      setEndCitySuggestions(suggestions);
    }, 300);
  };

  const handleMiddleCityChange = async (value: string, index: number) => {
    const newMiddleCities = [...middleCities];
    newMiddleCities[index].name = value;
    setMiddleCities(newMiddleCities);

    if (middleCityTimeoutRefs.current[index]) {
      clearTimeout(middleCityTimeoutRefs.current[index]!);
      middleCityTimeoutRefs.current[index] = null;
    }
    
    if (value.length < 2) {
      const newSuggestions = [...middleCitySuggestions];
      newSuggestions[index] = [];
      setMiddleCitySuggestions(newSuggestions);
      return;
    }
    
    middleCityTimeoutRefs.current[index] = setTimeout(async () => {
      const suggestions = await fetchCitySuggestions(value);
      const newSuggestions = [...middleCitySuggestions];
      newSuggestions[index] = suggestions;
      setMiddleCitySuggestions(newSuggestions);
    }, 300);
  };

  const handleMiddleDaysChange = (days: number, index: number) => {
    const newMiddleCities = [...middleCities];
    newMiddleCities[index].days = days;
    setMiddleCities(newMiddleCities);
  };

  const selectCity = (city: string, type: 'start' | 'end' | 'middle', index?: number) => {
    if (type === 'start') {
      setStartCity(city);
      setStartCitySuggestions([]);
    } else if (type === 'end') {
      setEndCity(city);
      setEndCitySuggestions([]);
    } else if (type === 'middle' && index !== undefined) {
      const newMiddleCities = [...middleCities];
      newMiddleCities[index].name = city;
      setMiddleCities(newMiddleCities);
      
      const newSuggestions = [...middleCitySuggestions];
      newSuggestions[index] = [];
      setMiddleCitySuggestions(newSuggestions);
    }
  };

  const extractIataCode = (displayText: string): string => {
    const match = displayText.match(/\(([A-Z]{3})\)/);
    return match ? match[1] : displayText;
  };

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    if (date && numberOfCities === 2) {
      setEndDate(date);
    } else if (date && totalDays > 0) {
      const start = new Date(date);
      const end = new Date(start);
      end.setDate(start.getDate() + totalDays);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    return maxDate.toISOString().split('T')[0];
  };

  const handleSearch = async () => {
    if (!startCity || !endCity) {
      alert('Please enter both start and end cities');
      return;
    }

    if (numberOfCities > 2 && totalDays === 0) {
      alert('Please set stay durations for your middle cities');
      return;
    }

    if (!startDate || !endDate) {
      alert('Please select your travel dates');
      return;
    }

    if (numberOfCities > 2) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const actualDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (actualDays !== totalDays) {
        alert(`Date range (${actualDays} days) must match total trip days (${totalDays} days)`);
        return;
      }
    }

    const processedStartCity = extractIataCode(startCity);
    const processedEndCity = extractIataCode(endCity);
    const processedMiddleCities = middleCities
      .filter(city => city.name.trim() !== '')
      .map(city => ({
        ...city,
        name: extractIataCode(city.name)
      }));

    const data: SearchData = {
      startCity: processedStartCity,
      endCity: processedEndCity,
      middleCities: processedMiddleCities,
      totalDays: numberOfCities === 2 ? 0 : totalDays,
      startDate,
      endDate,
      adults,
      children,
      infants
    };
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_city: processedStartCity,
          end_city: processedEndCity,
          middle_cities: processedMiddleCities,
          total_days: numberOfCities === 2 ? 0 : totalDays,
          start_date: startDate,
          end_date: endDate,
          adults: adults,
          children: children,
          infants: infants
        })
      });
      
      const apiResults = await response.json();
      
      setSearchData({
        ...data,
        apiResults: apiResults
      });
      setCurrentPage('results');
      
    } catch (error) {
      console.error('Error calling API:', error);
      setSearchData({
        ...data,
        apiResults: []
      });
      setCurrentPage('results');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (startCityTimeoutRef.current) {
        clearTimeout(startCityTimeoutRef.current);
      }
      if (endCityTimeoutRef.current) {
        clearTimeout(endCityTimeoutRef.current);
      }
      Object.values(middleCityTimeoutRefs.current).forEach(timeout => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
    };
  }, []);

  if (currentPage === 'results' && searchData) {
    return <ResultsPage searchData={searchData} onNewSearch={() => setCurrentPage('search')} />;
  }

  return (
    <div className="App">
      <header className="header">
        <div className="logo">Airplane</div>
        {isLoading && (
          <div className="loading-notice">
            Finding optimal routes...
          </div>
        )}
      </header>

      <div className="search-container">
        <h2>Find Your Optimal Travel Route</h2>
        
        <div className="search-row">
          <div className="input-group">
            <label>Total Cities</label>
            <select 
              value={numberOfCities} 
              onChange={(e) => setNumberOfCities(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num} cities</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Start City</label>
            <div className="autocomplete-container">
              <input 
                type="text" 
                placeholder="e.g., London"
                value={startCity}
                onChange={(e) => handleStartCityChange(e.target.value)}
                disabled={isLoading}
              />
              {startCitySuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {startCitySuggestions.map((city, index) => (
                    <div 
                      key={index} 
                      className="suggestion-item"
                      onClick={() => selectCity(city, 'start')}
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="input-group">
            <label>End City</label>
            <div className="autocomplete-container">
              <input 
                type="text" 
                placeholder="e.g., Paris" 
                value={endCity}
                onChange={(e) => handleEndCityChange(e.target.value)}
                disabled={isLoading}
              />
              {endCitySuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {endCitySuggestions.map((city, index) => (
                    <div 
                      key={index} 
                      className="suggestion-item"
                      onClick={() => selectCity(city, 'end')}
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {numberOfCities > 2 && (
          <div className="search-row">
            <div className="input-group">
              <label>Cities Between & Stay Duration</label>
              <div className="cities-container">
                {middleCities.map((city, index) => (
                  <div key={index} className="city-with-days">
                    <div className="autocomplete-container">
                      <input 
                        type="text" 
                        placeholder={`City ${index + 1}`}
                        value={city.name}
                        onChange={(e) => handleMiddleCityChange(e.target.value, index)}
                        disabled={isLoading}
                      />
                      {middleCitySuggestions[index] && middleCitySuggestions[index].length > 0 && (
                        <div className="suggestions-dropdown">
                          {middleCitySuggestions[index].map((cityName, cityIndex) => (
                            <div 
                              key={cityIndex} 
                              className="suggestion-item"
                              onClick={() => selectCity(cityName, 'middle', index)}
                            >
                              {cityName}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="days-input">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={city.days}
                        onChange={(e) => handleMiddleDaysChange(Number(e.target.value), index)}
                        className="number-input small"
                        disabled={isLoading}
                      />
                      <span>days</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="total-days">
                Total trip days: <strong>{totalDays}</strong>
                {totalDays === 0 && <span className="warning"> (Set days for each city)</span>}
              </div>
            </div>
          </div>
        )}

        <div className="search-row">
          <div className="input-group">
            <label>Start Date</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              min={getMinDate()}
              max={getMaxDate()}
              disabled={isLoading}
            />
          </div>

          <div className="input-group">
            <label>End Date</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || getMinDate()}
              max={getMaxDate()}
              readOnly={numberOfCities > 2}
              disabled={isLoading}
            />
            <div className="date-info">
              {numberOfCities === 2 ? 'Direct flight (same day)' : 
               totalDays > 0 ? `${totalDays} days total` : 'Set days first'}
            </div>
          </div>

          <div className="input-group">
            <label>Passengers</label>
            <div className="passenger-selectors">
              <div className="passenger-type">
                <span>Adults:</span>
                <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} disabled={isLoading}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div className="passenger-type">
                <span>Children:</span>
                <select value={children} onChange={(e) => setChildren(Number(e.target.value))} disabled={isLoading}>
                  {[0, 1, 2, 3, 4, 5, 6].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div className="passenger-type">
                <span>Infants:</span>
                <select value={infants} onChange={(e) => setInfants(Number(e.target.value))} disabled={isLoading}>
                  {[0, 1, 2, 3].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button 
            className={`search-button ${isLoading ? 'disabled' : ''}`} 
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? 'Finding Routes...' : 'Find Optimal Route'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;