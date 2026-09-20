from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import copernicusmarine
import numpy as np
import pandas as pd
import requests

from io import StringIO
from typing import Optional


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="ORION FloatChat Backend",
    description="Real Copernicus Marine powered ocean intelligence API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# COPERNICUS CONFIGURATION
# ============================================================

# ------------------------------------------------------------
# ARGO / INSITU
# ------------------------------------------------------------

ARGO_DATASET_ID = "cmems_obs-ins_glo_phybgcwav_mynrt_na_irr"
ARGO_DATASET_VERSION = "202311"
ARGO_DATASET_PART = "latest"

ARGO_INDEX_URL = (
    "https://s3.waw3-1.cloudferro.com/"
    "mdl-native-01/native/"
    "INSITU_GLO_PHYBGCWAV_DISCRETE_MYNRT_013_030/"
    "cmems_obs-ins_glo_phybgcwav_mynrt_na_irr_202311/"
    "index_platform.txt"
)


# ------------------------------------------------------------
# OCEAN 4D
# ------------------------------------------------------------

OCEAN_DATASET_ID = (
    "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m"
)

OCEAN_DATASET_VERSION = "202406"
OCEAN_DATASET_PART = "default"
OCEAN_VARIABLE = "thetao"


# ============================================================
# CACHE
# ============================================================

# Cache real ARGO platform IDs.
ARGO_FLOAT_CACHE = None

# Cache complete ARGO platform dataframe.
ARGO_PLATFORM_DATAFRAME_CACHE = None


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():

    print("=" * 70)
    print("ORION FloatChat Backend")
    print("Real Copernicus Marine Data")
    print("=" * 70)

    try:
        copernicusmarine.login()

        print("Copernicus Marine login: OK")

    except Exception as e:

        print(
            "Copernicus Marine login warning:",
            e,
        )

    print("ARGO dataset:", ARGO_DATASET_ID)
    print("ARGO version:", ARGO_DATASET_VERSION)
    print("ARGO part:", ARGO_DATASET_PART)

    print("Ocean dataset:", OCEAN_DATASET_ID)
    print("Ocean version:", OCEAN_DATASET_VERSION)
    print("Ocean part:", OCEAN_DATASET_PART)

    print("=" * 70)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "project": "ORION FloatChat",
        "source": "Copernicus Marine",
        "argo_dataset": ARGO_DATASET_ID,
        "ocean_dataset": OCEAN_DATASET_ID,
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "source": "Copernicus Marine",
    }


# ============================================================
# LOAD OFFICIAL ARGO PLATFORM INDEX
# ============================================================

def load_argo_platform_index():
    global ARGO_PLATFORM_DATAFRAME_CACHE

    if ARGO_PLATFORM_DATAFRAME_CACHE is not None:
        print(
            "Using cached Copernicus ARGO platform index."
        )
        return ARGO_PLATFORM_DATAFRAME_CACHE

    print()
    print("=" * 70)
    print("DOWNLOADING OFFICIAL COPERNICUS ARGO PLATFORM INDEX")
    print("=" * 70)

    response = requests.get(
        ARGO_INDEX_URL,
        timeout=60,
        headers={
            "User-Agent": "ORION-FloatChat/1.0"
        },
    )

    response.raise_for_status()

    print(
        "Platform index downloaded:",
        len(response.content),
        "bytes",
    )

    text = response.text

    if not text.strip():
        raise RuntimeError(
            "Copernicus ARGO platform index is empty."
        )

    print(
        "Platform index lines:",
        len(text.splitlines()),
    )

    dataframe = pd.read_csv(
        StringIO(text),
        sep=",",
        skiprows=5,
        dtype=str,
        on_bad_lines="skip",
    )

    dataframe.columns = [
        str(column).strip()
        for column in dataframe.columns
    ]

    print(
        "Platform index columns:",
        list(dataframe.columns),
    )
    print(
    "FIRST ROW:",
    dataframe.head(1).to_dict("records")
    )

    if dataframe.empty:
        raise RuntimeError(
            "Copernicus ARGO platform index contains no rows."
        )

    # Current Copernicus index uses "platform_code".
    # Example: 3902498___PF
    if "# platform_code" not in dataframe.columns:
        raise RuntimeError(
            "The # platform_code column was not found "
            "in the Copernicus ARGO platform index."
        )

    dataframe = dataframe.rename(
        columns={
        "# platform_code": "#_platform_code"
        }
    )

    ARGO_PLATFORM_DATAFRAME_CACHE = dataframe

    return dataframe


# ============================================================
# REAL PROFILING FLOAT IDS
# ============================================================

def get_real_profiling_float_ids():
    global ARGO_FLOAT_CACHE

    if ARGO_FLOAT_CACHE is not None:
        print("Using cached real ARGO platform IDs.")
        return ARGO_FLOAT_CACHE

    # ---------------------------------------------------------
    # LOAD OFFICIAL COPERNICUS PLATFORM METADATA
    # ---------------------------------------------------------

    metadata_url = (
        "https://s3.waw3-1.cloudferro.com/"
        "mdl-arco-time-061/arco/"
        "INSITU_GLO_PHYBGCWAV_DISCRETE_MYNRT_013_030/"
        "cmems_obs-ins_glo_phybgcwav_mynrt_na_irr_202311"
        "--ext--latest/platforms.json.gz"
    )

    print("Downloading Copernicus platform metadata...")

    response = requests.get(
        metadata_url,
        timeout=60,
    )

    response.raise_for_status()

    metadata = response.json()

    # Handle either a direct list or a dictionary containing platforms
    if isinstance(metadata, list):
        platform_records = metadata

    elif isinstance(metadata, dict):
        platform_records = (
            metadata.get("platforms")
            or metadata.get("data")
            or []
        )

    else:
        platform_records = []

    print(
        "Platform metadata records:",
        len(platform_records),
    )

    # ---------------------------------------------------------
    # KEEP ONLY REAL PROFILING FLOATS
    # ptype == PF
    # ---------------------------------------------------------

    profiling_codes = []

    for record in platform_records:

        if not isinstance(record, dict):
            continue

        platform_type = str(
            record.get("ptype", "")
        ).strip().upper()

        if platform_type != "PF":
            continue

        platform_code = (
            record.get("platform_code")
            or record.get("platform_id")
            or record.get("id")
        )

        if platform_code is None:
            continue

        platform_code = str(
            platform_code
        ).strip()

        if not platform_code:
            continue

        # Example:
        # 3902498___PF
        #
        # We need the real WMO/platform number:
        # 3902498

        if "___" in platform_code:
            wmo_code = platform_code.split(
                "___",
                1,
            )[0].strip()
        else:
            wmo_code = platform_code

        if wmo_code:
            profiling_codes.append(wmo_code)

    # Remove duplicates while preserving order
    profiling_codes = list(
        dict.fromkeys(profiling_codes)
    )

    print(
        "REAL PROFILING FLOATS FOUND:",
        len(profiling_codes),
    )

    print(
        "First real profiling floats:",
        profiling_codes[:10],
    )

    # ---------------------------------------------------------
    # VERIFY AGAINST COPERNICUS PLATFORM INDEX
    # ---------------------------------------------------------

    dataframe = load_argo_platform_index()

    csv_wmo_codes = set(
        dataframe[
            "wmo_platform_code"
        ]
        .dropna()
        .astype(str)
        .str.strip()
    )

    csv_platform_codes = set(
        dataframe[
            "#_platform_code"
        ]
        .dropna()
        .astype(str)
        .str.strip()
    )

    verified = []

    for code in profiling_codes:

        if (
            code in csv_wmo_codes
            or code in csv_platform_codes
        ):
            verified.append(code)

    print(
        "PROFILING FLOATS VERIFIED IN INDEX:",
        len(verified),
    )

    print(
        "First verified floats:",
        verified[:10],
    )

    ARGO_FLOAT_CACHE = verified

    return ARGO_FLOAT_CACHE
# ============================================================
# ARGO NETWORK
# ============================================================

@app.get("/argo")
def get_argo_floats(
    limit: int = Query(
        50,
        ge=1,
        le=200,
    )
):

    print()
    print("=" * 70)
    print("ARGO NETWORK REQUEST")
    print("Requested limit:", limit)
    print("=" * 70)

    try:

        dataframe = load_argo_platform_index()

        all_float_ids = (
            get_real_profiling_float_ids()
        )

        total_available = len(
            all_float_ids
        )

        selected_ids = all_float_ids[
            :limit
        ]

        print(
            "RETURNING:",
            len(selected_ids),
        )

        # ----------------------------------------------------
        # BUILD REAL METADATA
        # ----------------------------------------------------

        floats = []

        for platform_id in selected_ids:

            
            platform_mask = (
                dataframe["#_platform_code"]
                .astype(str)
                .str.strip()
                .eq(str(platform_id).strip())
            )

            if "wmo_platform_code" in dataframe.columns:

                platform_mask = (
                    platform_mask
                    |
                    dataframe["wmo_platform_code"]
                    .astype(str)
                    .str.strip()
                    .eq(str(platform_id).strip())
                )

            matching_rows = dataframe[platform_mask]

            if matching_rows.empty:

                continue

            row = matching_rows.iloc[0]

            # Institution
            institution = None

            if (
                "institution" in dataframe.columns
                and pd.notna(row.get("institution"))
            ):

                institution = str(
                    row["institution"]
                ).strip()

            # Latitude
            latitude = None

            if (
                "last_latitude_observation"
                in dataframe.columns
            ):

                try:

                    if pd.notna(
                        row.get(
                            "last_latitude_observation"
                        )
                    ):

                        latitude = float(
                            row[
                                "last_latitude_observation"
                            ]
                        )

                except Exception:

                    latitude = None

            # Longitude
            longitude = None

            if (
                "last_longitude_observation"
                in dataframe.columns
            ):

                try:

                    if pd.notna(
                        row.get(
                            "last_longitude_observation"
                        )
                    ):

                        longitude = float(
                            row[
                                "last_longitude_observation"
                            ]
                        )

                except Exception:

                    longitude = None

            # Latest time
            latest_time = None

            if (
                "last_date_observation"
                in dataframe.columns
            ):

                raw_time = row.get(
                    "last_date_observation"
                )

                if pd.notna(raw_time):

                    try:

                        latest_time = pd.Timestamp(
                            raw_time
                        ).isoformat()

                    except Exception:

                        latest_time = str(
                            raw_time
                        )

            # WMO platform code
            wmo_platform_code = None

            if (
                "wmo_platform_code"
                in dataframe.columns
            ):

                raw_wmo = row.get(
                    "wmo_platform_code"
                )

                if pd.notna(raw_wmo):

                    wmo_platform_code = str(
                        raw_wmo
                    ).strip()

            floats.append(
                {
                    "platform_id": platform_id,
                    "platform_type": "PF",
                    "wmo_platform_code": (
                        wmo_platform_code
                    ),
                    "institution": institution,
                    "latitude": latitude,
                    "longitude": longitude,
                    "latest_time": latest_time,
                    "source": "Copernicus Marine",
                }
            )

        return {
            "source": "Copernicus Marine",
            "dataset": ARGO_DATASET_ID,
            "dataset_version": ARGO_DATASET_VERSION,
            "dataset_part": ARGO_DATASET_PART,
            "count": len(floats),
            "total_available": total_available,
            "floats": floats,
            "platforms": floats,
        }

    except Exception as e:

        print(
            "ARGO ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve real Copernicus "
                f"ARGO platform index: {str(e)}"
            ),
        )


# ============================================================
# ARGO FLOAT DETAIL
# ============================================================

@app.get("/argo/{platform_id}")
def get_argo_float(
    platform_id: str
):

    print()
    print("=" * 70)
    print("ARGO FLOAT DETAIL")
    print("Platform:", platform_id)
    print("=" * 70)

    try:

        dataframe = copernicusmarine.read_dataframe(
            dataset_id=ARGO_DATASET_ID,
            dataset_version=ARGO_DATASET_VERSION,
            part=ARGO_DATASET_PART,
            service="platformseries",
            platform_id=platform_id,
        )

    except Exception as e:

        print(
            "ARGO FLOAT ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve real observations "
                f"for {platform_id}: {str(e)}"
            ),
        )

    if dataframe is None or dataframe.empty:

        raise HTTPException(
            status_code=404,
            detail=(
                f"No Copernicus observations found "
                f"for {platform_id}"
            ),
        )

    df = dataframe.copy()

    print(
        "REAL OBSERVATIONS:",
        len(df),
    )

    # --------------------------------------------------------
    # DATETIME
    # --------------------------------------------------------

    if "time" in df.columns:

        df["time"] = pd.to_datetime(
            df["time"],
            errors="coerce",
        )

    # --------------------------------------------------------
    # NUMERIC COLUMNS
    # --------------------------------------------------------

    for column in [
        "latitude",
        "longitude",
        "depth",
        "pressure",
        "value",
    ]:

        if column in df.columns:

            df[column] = pd.to_numeric(
                df[column],
                errors="coerce",
            )

    # --------------------------------------------------------
    # SORT
    # --------------------------------------------------------

    if "time" in df.columns:

        df = df.sort_values(
            "time"
        )

    # --------------------------------------------------------
    # LATEST REAL OBSERVATION
    # --------------------------------------------------------

    latest_row = None

    if not df.empty:

        latest = df.iloc[-1]

        latest_time = None

        if pd.notna(
            latest.get("time")
        ):

            latest_time = (
                pd.Timestamp(
                    latest["time"]
                ).isoformat()
            )

        latest_latitude = None

        if pd.notna(
            latest.get("latitude")
        ):

            latest_latitude = float(
                latest["latitude"]
            )

        latest_longitude = None

        if pd.notna(
            latest.get("longitude")
        ):

            latest_longitude = float(
                latest["longitude"]
            )

        latest_depth = None

        if pd.notna(
            latest.get("depth")
        ):

            latest_depth = float(
                latest["depth"]
            )

        latest_variable = None

        if pd.notna(
            latest.get("variable")
        ):

            latest_variable = str(
                latest["variable"]
            )

        latest_value = None

        if pd.notna(
            latest.get("value")
        ):

            latest_value = float(
                latest["value"]
            )

        latest_row = {
            "time": latest_time,
            "latitude": latest_latitude,
            "longitude": latest_longitude,
            "depth": latest_depth,
            "variable": latest_variable,
            "value": latest_value,
        }

    # --------------------------------------------------------
    # INSTITUTION
    # --------------------------------------------------------

    institution = None

    if "institution" in df.columns:

        institutions = (
            df["institution"]
            .dropna()
            .astype(str)
            .unique()
        )

        if len(institutions) > 0:

            institution = institutions[0]

    # --------------------------------------------------------
    # LATEST TIME
    # --------------------------------------------------------

    latest_time = None

    if "time" in df.columns:

        valid_times = (
            df["time"]
            .dropna()
        )

        if len(valid_times) > 0:

            latest_time = (
                valid_times
                .max()
                .isoformat()
            )

    # --------------------------------------------------------
    # TEMPERATURE / SALINITY
    # --------------------------------------------------------

    temperature_values = []
    salinity_values = []

    if "variable" in df.columns:

        temp_df = df[
            df["variable"]
            .astype(str)
            .str.upper()
            .eq("TEMP")
        ]

        salinity_df = df[
            df["variable"]
            .astype(str)
            .str.upper()
            .eq("PSAL")
        ]

        if not temp_df.empty:

            temperature_values = (
                pd.to_numeric(
                    temp_df["value"],
                    errors="coerce",
                )
                .dropna()
                .tolist()
            )

        if not salinity_df.empty:

            salinity_values = (
                pd.to_numeric(
                    salinity_df["value"],
                    errors="coerce",
                )
                .dropna()
                .tolist()
            )

    # --------------------------------------------------------
    # CLEAN OBSERVATIONS
    # --------------------------------------------------------

    observations = []

    for _, row in df.iterrows():

        value = row.get(
            "value"
        )

        if pd.isna(value):

            continue

        try:

            numeric_value = float(
                value
            )

        except Exception:

            continue

        observation = {
            "variable": (
                str(
                    row["variable"]
                )
                if pd.notna(
                    row.get("variable")
                )
                else None
            ),

            "platform_id": (
                str(
                    row["platform_id"]
                )
                if pd.notna(
                    row.get("platform_id")
                )
                else platform_id
            ),

            "platform_type": (
                str(
                    row["platform_type"]
                )
                if pd.notna(
                    row.get("platform_type")
                )
                else "PF"
            ),

            "time": (
                pd.Timestamp(
                    row["time"]
                ).isoformat()
                if pd.notna(
                    row.get("time")
                )
                else None
            ),

            "longitude": (
                float(
                    row["longitude"]
                )
                if pd.notna(
                    row.get("longitude")
                )
                else None
            ),

            "latitude": (
                float(
                    row["latitude"]
                )
                if pd.notna(
                    row.get("latitude")
                )
                else None
            ),

            "depth": (
                float(
                    row["depth"]
                )
                if pd.notna(
                    row.get("depth")
                )
                else None
            ),

            "pressure": (
                float(
                    row["pressure"]
                )
                if pd.notna(
                    row.get("pressure")
                )
                else None
            ),

            "value": numeric_value,

            "value_qc": (
                str(
                    row["value_qc"]
                )
                if pd.notna(
                    row.get("value_qc")
                )
                else None
            ),

            "institution": (
                str(
                    row["institution"]
                )
                if pd.notna(
                    row.get("institution")
                )
                else institution
            ),

            "source": "Copernicus Marine",
        }

        observations.append(
            observation
        )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "source": "Copernicus Marine",
        "dataset": ARGO_DATASET_ID,
        "dataset_version": ARGO_DATASET_VERSION,
        "dataset_part": ARGO_DATASET_PART,

        "platform_id": platform_id,
        "platform_type": "PF",

        "institution": institution,

        "latest_time": latest_time,

        "latest": latest_row,

        "observation_count": len(
            observations
        ),

        "statistics": {
            "temperature": {
                "count": len(
                    temperature_values
                ),

                "minimum": (
                    float(
                        min(
                            temperature_values
                        )
                    )
                    if temperature_values
                    else None
                ),

                "maximum": (
                    float(
                        max(
                            temperature_values
                        )
                    )
                    if temperature_values
                    else None
                ),

                "average": (
                    float(
                        np.mean(
                            temperature_values
                        )
                    )
                    if temperature_values
                    else None
                ),
            },

            "salinity": {
                "count": len(
                    salinity_values
                ),

                "minimum": (
                    float(
                        min(
                            salinity_values
                        )
                    )
                    if salinity_values
                    else None
                ),

                "maximum": (
                    float(
                        max(
                            salinity_values
                        )
                    )
                    if salinity_values
                    else None
                ),

                "average": (
                    float(
                        np.mean(
                            salinity_values
                        )
                    )
                    if salinity_values
                    else None
                ),
            },
        },

        "observations": observations,

        "data": observations,
    }


# ============================================================
# HELPER: FIND DIMENSION
# ============================================================

def find_dimension(
    data_array,
    possible_names,
):

    for name in possible_names:

        if name in data_array.dims:

            return name

        if name in data_array.coords:

            return name

    return None


# ============================================================
# OCEAN 4D
# ============================================================

@app.get("/ocean-4d")
def get_ocean_4d(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    depth: Optional[float] = None,
):

    print()
    print("=" * 70)
    print("OCEAN 4D REQUEST")
    print("=" * 70)

    print(
        "Requested latitude:",
        latitude,
    )

    print(
        "Requested longitude:",
        longitude,
    )

    print(
        "Requested depth:",
        depth,
    )

    # ========================================================
    # SMALL GEOGRAPHIC WINDOW
    # ========================================================

    if (
        latitude is not None
        and longitude is not None
    ):

        minimum_latitude = (
            latitude - 0.5
        )

        maximum_latitude = (
            latitude + 0.5
        )

        minimum_longitude = (
            longitude - 0.5
        )

        maximum_longitude = (
            longitude + 0.5
        )

    else:

        minimum_latitude = 10.0
        maximum_latitude = 12.0

        minimum_longitude = 79.0
        maximum_longitude = 81.0

    # ========================================================
    # SMALL DEPTH WINDOW
    # ========================================================

    if depth is not None:

        minimum_depth = max(
            0.5,
            depth - 5.0,
        )

        maximum_depth = (
            depth + 5.0
        )

    else:

        minimum_depth = 0.5
        maximum_depth = 20.0

    print(
        "Latitude:",
        minimum_latitude,
        "to",
        maximum_latitude,
    )

    print(
        "Longitude:",
        minimum_longitude,
        "to",
        maximum_longitude,
    )

    print(
        "Depth:",
        minimum_depth,
        "to",
        maximum_depth,
    )

    # ========================================================
    # REAL COPERNICUS TIME
    # ========================================================

    start_time = "2026-09-05T00:00:00"
    end_time = "2026-09-05T00:00:00"

    dataset = None

    # ========================================================
    # OPEN DATASET
    # ========================================================

    try:

        print(
            "Opening Copernicus ocean dataset..."
        )

        dataset = copernicusmarine.open_dataset(
            dataset_id=OCEAN_DATASET_ID,

            dataset_version=(
                OCEAN_DATASET_VERSION
            ),

            dataset_part=(
                OCEAN_DATASET_PART
            ),

            variables=[
                OCEAN_VARIABLE
            ],

            minimum_longitude=(
                minimum_longitude
            ),

            maximum_longitude=(
                maximum_longitude
            ),

            minimum_latitude=(
                minimum_latitude
            ),

            maximum_latitude=(
                maximum_latitude
            ),

            minimum_depth=(
                minimum_depth
            ),

            maximum_depth=(
                maximum_depth
            ),

            start_datetime=start_time,

            end_datetime=end_time,

            coordinates_selection_method=(
                "nearest"
            ),
        )

        print(
            "Copernicus dataset opened."
        )

    except Exception as e:

        print(
            "OCEAN DATASET ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to retrieve real "
                "Copernicus ocean data: "
                f"{str(e)}"
            ),
        )

    # ========================================================
    # PROCESS DATA
    # ========================================================

    try:

        if OCEAN_VARIABLE not in dataset:

            raise HTTPException(
                status_code=500,
                detail=(
                    f"Variable {OCEAN_VARIABLE} "
                    "not found."
                ),
            )

        data_array = dataset[
            OCEAN_VARIABLE
        ]

        print(
            "Original dimensions:",
            data_array.dims,
        )

        print(
            "Original sizes:",
            data_array.sizes,
        )

        # ====================================================
        # REDUCE SPATIAL GRID
        # ====================================================

        for dim in [
            "latitude",
            "lat",
        ]:

            if (
                dim in data_array.dims
                and data_array.sizes[dim] > 8
            ):

                data_array = data_array.isel(
                    {
                        dim: slice(
                            None,
                            None,
                            2,
                        )
                    }
                )

        for dim in [
            "longitude",
            "lon",
        ]:

            if (
                dim in data_array.dims
                and data_array.sizes[dim] > 8
            ):

                data_array = data_array.isel(
                    {
                        dim: slice(
                            None,
                            None,
                            2,
                        )
                    }
                )

        print(
            "Reduced dimensions:",
            data_array.dims,
        )

        print(
            "Reduced sizes:",
            data_array.sizes,
        )

        # ====================================================
        # FIND COORDINATES
        # ====================================================

        time_dim = find_dimension(
            data_array,
            ["time"],
        )

        depth_dim = find_dimension(
            data_array,
            ["depth"],
        )

        latitude_dim = find_dimension(
            data_array,
            [
                "latitude",
                "lat",
            ],
        )

        longitude_dim = find_dimension(
            data_array,
            [
                "longitude",
                "lon",
            ],
        )

        print(
            "Time dimension:",
            time_dim,
        )

        print(
            "Depth dimension:",
            depth_dim,
        )

        print(
            "Latitude dimension:",
            latitude_dim,
        )

        print(
            "Longitude dimension:",
            longitude_dim,
        )

        if latitude_dim is None:

            raise HTTPException(
                status_code=500,
                detail="Latitude coordinate not found.",
            )

        if longitude_dim is None:

            raise HTTPException(
                status_code=500,
                detail="Longitude coordinate not found.",
            )

        if depth_dim is None:

            raise HTTPException(
                status_code=500,
                detail="Depth coordinate not found.",
            )

        # ====================================================
        # REAL DEPTH
        # ====================================================

        depth_values = np.asarray(
            data_array[
                depth_dim
            ].values
        )

        actual_depth = None

        if len(depth_values) > 0:

            if depth is not None:

                depth_index = int(
                    np.argmin(
                        np.abs(
                            depth_values
                            - depth
                        )
                    )
                )

            else:

                depth_index = 0

            actual_depth = float(
                depth_values[
                    depth_index
                ]
            )

        print(
            "Actual Copernicus depth:",
            actual_depth,
        )

        # ====================================================
        # CONVERT REAL DATA TO DATAFRAME
        # ====================================================

        print(
            "Loading reduced real data..."
        )

        dataframe = (
            data_array
            .to_dataframe(
                name="value"
            )
            .reset_index()
        )

        print(
            "Dataframe rows:",
            len(dataframe),
        )

        # ====================================================
        # COLUMN NAMES
        # ====================================================

        if "latitude" in dataframe.columns:

            latitude_column = "latitude"

        elif "lat" in dataframe.columns:

            latitude_column = "lat"

        else:

            latitude_column = None

        if "longitude" in dataframe.columns:

            longitude_column = "longitude"

        elif "lon" in dataframe.columns:

            longitude_column = "lon"

        else:

            longitude_column = None

        depth_column = (
            "depth"
            if "depth" in dataframe.columns
            else None
        )

        time_column = (
            "time"
            if "time" in dataframe.columns
            else None
        )

        # ====================================================
        # BUILD OBSERVATIONS
        # ====================================================

        observations = []

        for _, row in dataframe.iterrows():

            value = row.get(
                "value"
            )

            if pd.isna(value):

                continue

            try:

                numeric_value = float(
                    value
                )

            except Exception:

                continue

            if not np.isfinite(
                numeric_value
            ):

                continue

            # Latitude
            if latitude_column:

                row_latitude = row.get(
                    latitude_column
                )

            else:

                row_latitude = None

            # Longitude
            if longitude_column:

                row_longitude = row.get(
                    longitude_column
                )

            else:

                row_longitude = None

            # Depth
            if depth_column:

                row_depth = row.get(
                    depth_column
                )

            else:

                row_depth = actual_depth

            # Time
            if time_column:

                row_time = row.get(
                    time_column
                )

            else:

                row_time = start_time

            # Safe latitude
            try:

                row_latitude = (
                    float(row_latitude)
                    if pd.notna(
                        row_latitude
                    )
                    else None
                )

            except Exception:

                row_latitude = None

            # Safe longitude
            try:

                row_longitude = (
                    float(row_longitude)
                    if pd.notna(
                        row_longitude
                    )
                    else None
                )

            except Exception:

                row_longitude = None

            # Safe depth
            try:

                row_depth = (
                    float(row_depth)
                    if pd.notna(
                        row_depth
                    )
                    else None
                )

            except Exception:

                row_depth = None

            # Time
            if pd.notna(row_time):

                try:

                    row_time = pd.Timestamp(
                        row_time
                    ).isoformat()

                except Exception:

                    row_time = str(
                        row_time
                    )

            else:

                row_time = None

            observations.append(
                {
                    "time": row_time,
                    "depth": row_depth,
                    "latitude": row_latitude,
                    "longitude": row_longitude,
                    "value": numeric_value,
                }
            )

        # ====================================================
        # SAFETY CAP
        # ====================================================

        if len(observations) > 7000:

            observations = observations[
                ::2
            ]

        print(
            "REAL OCEAN POINTS RETURNED:",
            len(observations),
        )

        # ====================================================
        # ACTUAL DATA LOCATION
        # ====================================================

        actual_latitude = None
        actual_longitude = None

        valid_latitudes = [
            point["latitude"]
            for point in observations
            if point["latitude"] is not None
        ]

        valid_longitudes = [
            point["longitude"]
            for point in observations
            if point["longitude"] is not None
        ]

        if valid_latitudes:

            actual_latitude = float(
                np.mean(
                    valid_latitudes
                )
            )

        if valid_longitudes:

            actual_longitude = float(
                np.mean(
                    valid_longitudes
                )
            )

        # ====================================================
        # STATISTICS
        # ====================================================

        numeric_values = [
            point["value"]
            for point in observations
        ]

        if numeric_values:

            average_value = float(
                np.mean(
                    numeric_values
                )
            )

            minimum_value = float(
                np.min(
                    numeric_values
                )
            )

            maximum_value = float(
                np.max(
                    numeric_values
                )
            )

        else:

            average_value = None
            minimum_value = None
            maximum_value = None

        # ====================================================
        # RESPONSE
        # ====================================================

        return {

            "source": "Copernicus Marine",

            "dataset": OCEAN_DATASET_ID,

            "dataset_version": (
                OCEAN_DATASET_VERSION
            ),

            "dataset_part": (
                OCEAN_DATASET_PART
            ),

            "variable": OCEAN_VARIABLE,

            "variable_name": (
                "Sea Water Temperature"
            ),

            "units": "°C",

            "time": start_time,

            "requested_location": (
                {
                    "latitude": latitude,
                    "longitude": longitude,
                }
                if (
                    latitude is not None
                    and longitude is not None
                )
                else None
            ),

            "actual_data_location": (
                {
                    "latitude": actual_latitude,
                    "longitude": actual_longitude,
                }
                if (
                    actual_latitude is not None
                    and actual_longitude is not None
                )
                else None
            ),

            "requested_depth": depth,

            "actual_depth": actual_depth,

            "region": {

                "minimum_latitude": (
                    minimum_latitude
                ),

                "maximum_latitude": (
                    maximum_latitude
                ),

                "minimum_longitude": (
                    minimum_longitude
                ),

                "maximum_longitude": (
                    maximum_longitude
                ),
            },

            "statistics": {

                "average": average_value,

                "minimum": minimum_value,

                "maximum": maximum_value,

                "count": len(
                    numeric_values
                ),
            },

            "count": len(
                observations
            ),

            "points": observations,

            "observations": observations,
        }

    except HTTPException:

        raise

    except Exception as e:

        print(
            "OCEAN PROCESSING ERROR:",
            repr(e),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Error processing real "
                "Copernicus ocean data: "
                f"{str(e)}"
            ),
        )

    finally:

        try:

            if dataset is not None:

                dataset.close()

                print(
                    "Copernicus dataset closed."
                )

        except Exception:

            pass


# ============================================================
# RUN DIRECTLY
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )