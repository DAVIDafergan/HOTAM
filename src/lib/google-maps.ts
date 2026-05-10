declare global {
  interface Window {
    google?: any;
    __googleMapsPlacesPromise?: Promise<void>;
  }
}

export type GoogleAddressSelection = {
  formattedAddress: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

const getGoogleMapsApiKey = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const CITY_KEYS = ['locality', 'administrative_area_level_2', 'administrative_area_level_1'];

const normalizeCityName = (value: string) =>
  value
    .replace(/^ה/, '')
    .replace(/^עיר\s+/, '')
    .trim();

export function getCityFromAddressComponents(components?: any[]): string | null {
  if (!Array.isArray(components)) return null;

  for (const cityKey of CITY_KEYS) {
    const component = components.find((item: any) => Array.isArray(item?.types) && item.types.includes(cityKey));
    if (component?.long_name) return normalizeCityName(component.long_name);
  }

  return null;
}

export async function loadGoogleMapsPlacesScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  const googleMapsApiKey = getGoogleMapsApiKey();
  if (!googleMapsApiKey) throw new Error('חסר NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  if (window.google?.maps?.places) return;

  if (!window.__googleMapsPlacesPromise) {
    window.__googleMapsPlacesPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-places="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('טעינת Google Maps נכשלה.')));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&language=he&region=IL`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsPlaces = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('טעינת Google Maps נכשלה.'));
      document.head.appendChild(script);
    });
  }

  return window.__googleMapsPlacesPromise;
}

export async function reverseGeocodeWithGoogle(lat: number, lng: number): Promise<{ city: string | null }> {
  const googleMapsApiKey = getGoogleMapsApiKey();
  if (!googleMapsApiKey) throw new Error('חסר NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=he&region=IL&key=${googleMapsApiKey}`,
  );

  if (!response.ok) {
    throw new Error(`Location lookup failed (${response.status})`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
    return { city: null };
  }

  const city =
    getCityFromAddressComponents(data.results[0].address_components) ||
    getCityFromAddressComponents(data.results.find((result: any) => Array.isArray(result?.address_components))?.address_components);

  return { city };
}
