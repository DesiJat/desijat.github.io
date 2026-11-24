
import requests
import json
import os
import time

BASE_URL = "https://de1.api.radio-browser.info/json/stations/search"

COUNTRIES = [
    "US", "DE", "FR", "RU", "CN", "GB", "GR", "AU", "IT", "MX",
    "BR", "CA", "ES", "NL", "AR", "PL", "RO", "IN", "PH", "TR",
    "CO", "AE", "CH", "ID", "CL", "BE", "RS", "HU", "PT", "BG",
    "AT", "UA", "CZ", "HR", "PE", "DK", "NZ", "KW", "ZA", "SE",
    "IE", "TW", "VE", "LV", "EC", "UG", "NP", "BA", "SK", "FI",
    "IL", "UY", "EE", "SI", "NO", "JP", "LB", "LT", "DO", "AL",
    "TH", "AF", "DZ", "GH", "MD", "ZM", "KR", "MY", "NG", "GT",
    "BO", "HK", "PY", "LK", "SG", "AO", "CY", "EG", "CI", "BY",
    "SV", "MA", "PK", "TN", "KE", "CR", "CM", "MW", "PR", "SA",
    "MK", "ME", "JM", "HN", "KZ", "AZ", "RE", "PA", "LU", "SN"
]

OUTPUT_DIR = "radio_stations"

os.makedirs(OUTPUT_DIR, exist_ok=True)

headers = {
    "User-Agent": "RadioStationDownloader/1.0"
}

for index, country in enumerate(COUNTRIES, start=1):

    filename = os.path.join(OUTPUT_DIR, f"{country}.json")

    params = {
        "limit": 7500,
        "countrycode": country,
        "hidebroken": "true",
        "order": "clickcount",
        "reverse": "true"
    }

    try:
        print(f"[{index}/{len(COUNTRIES)}] Downloading {country}...")

        response = requests.get(
            BASE_URL,
            params=params,
            headers=headers,
            timeout=120
        )

        response.raise_for_status()

        stations = response.json()

        if not isinstance(stations, list):
            raise ValueError("Unexpected API response")

        with open(filename, "w", encoding="utf-8") as file:
            json.dump(
                stations,
                file,
                ensure_ascii=False,
                indent=2
            )

        print(f"  Saved {len(stations)} stations -> {filename}")

    except Exception as error:
        print(f"  ERROR {country}: {error}")

    time.sleep(1)

print("\nAll country downloads completed!")
