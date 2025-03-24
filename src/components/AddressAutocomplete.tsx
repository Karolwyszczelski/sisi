'use client';

import { useState, useEffect } from 'react';
import { useLoadScript } from '@react-google-maps/api';

declare global {
  interface Window {
    google: any;
  }
}

const libraries = ['places'];

type AddressAutocompleteProps = {
  setStreet: (value: string) => void;
  setCity: (value: string) => void;
  setPostalCode: (value: string) => void;
  setFlatNumber?: (value: string) => void; // Dodatkowe, jeśli chcesz łapać subpremise
};

export default function AddressAutocomplete({
  setStreet,
  setCity,
  setPostalCode,
  setFlatNumber,
}: AddressAutocompleteProps) {
  const [address, setAddress] = useState('');
  const [isAutocompleteLoaded, setIsAutocompleteLoaded] = useState(false);

  // Ładowanie skryptu Google Maps API
  const { isLoaded: mapsIsLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  // Obsługa zmiany miejsca w autouzupełnianiu
  const handlePlaceChanged = () => {
    const input = document.getElementById('address-input') as HTMLInputElement;
    if (!input) return;

    const autocomplete = new window.google.maps.places.Autocomplete(input);
    const place = autocomplete.getPlace();

    if (!place || !place.address_components) return;

    const subpremise = place.address_components.find((c: any) =>
      c.types.includes('subpremise')
    )?.long_name;
    const route = place.address_components.find((c: any) =>
      c.types.includes('route')
    )?.long_name;
    const streetNumber = place.address_components.find((c: any) =>
      c.types.includes('street_number')
    )?.long_name;
    const postalCodeComp = place.address_components.find((c: any) =>
      c.types.includes('postal_code')
    )?.long_name;
    const cityComp = place.address_components.find((c: any) =>
      c.types.includes('locality')
    )?.long_name;

    const formattedAddress = place.formatted_address || '';

    let finalStreet = '';
    if (route && streetNumber) {
      finalStreet = `${route} ${streetNumber}`;
    } else if (route) {
      finalStreet = route;
    } else {
      finalStreet = formattedAddress;
    }

    setStreet(finalStreet);
    setPostalCode(postalCodeComp || '');
    setCity(cityComp || '');
    if (setFlatNumber && subpremise) {
      setFlatNumber(subpremise);
    }
    setAddress(formattedAddress);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };

  useEffect(() => {
    if (mapsIsLoaded) {
      const input = document.getElementById('address-input') as HTMLInputElement;
      if (!input) return;

      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        types: ['address'],
      });
      autocomplete.addListener('place_changed', handlePlaceChanged);
      setIsAutocompleteLoaded(true);
    }
  }, [mapsIsLoaded]);

  return (
    <div>
      <input
        id="address-input"
        type="text"
        value={address}
        onChange={handleInputChange}
        placeholder="Wpisz swój adres"
        className="w-full px-3 py-2 border rounded-md"
      />
      {isAutocompleteLoaded && (
        <div className="text-sm text-gray-500 mt-2">
          Wybierz adres z listy
        </div>
      )}
    </div>
  );
}