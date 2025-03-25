'use client';

import { useState, useEffect, useRef } from 'react';
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
  setFlatNumber?: (value: string) => void;
};

export default function AddressAutocomplete({
  setStreet,
  setCity,
  setPostalCode,
  setFlatNumber,
}: AddressAutocompleteProps) {
  const [address, setAddress] = useState('');
  const [isAutocompleteLoaded, setIsAutocompleteLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isLoaded: mapsIsLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  useEffect(() => {
    if (mapsIsLoaded && inputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'pl' },
      });

      autocomplete.addListener('place_changed', () => {
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
          c.types.includes('locality') || c.types.includes('postal_town')
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
      });

      setIsAutocompleteLoaded(true);
    }
  }, [mapsIsLoaded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };

  return (
    <div>
      <input
        ref={inputRef}
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
