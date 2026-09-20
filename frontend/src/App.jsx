import { useEffect, useMemo, useState } from "react";
import "./App.css";
import "./Frontend.css";
import Ocean4D from "./Ocean4D";

const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const path = window.location.pathname;

  if (path === "/4d") {
    return <Ocean4D />;
  }

  if (path === "/ai-query") {
    return <AIOceanQuery />;
  }

  if (path.startsWith("/float/")) {
    const platformId = decodeURIComponent(path.split("/")[2] || "");
    return <FloatExplorer platformId={platformId} />;
  }

  return <ArgoNetwork />;
}

/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar() {
  const path = window.location.pathname;

  const navigate = (route) => {
    window.location.href = route;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">

        <div className="brand">
          <div className="brand-mark">
            <span className="brand-orbit orbit-one" />
            <span className="brand-orbit orbit-two" />
            <span className="brand-core" />
          </div>

          <div className="brand-text">
            <div className="brand-name">ORION</div>
            <div className="brand-subtitle">FLOATCHAT</div>
          </div>
        </div>

        <div className="sidebar-divider" />

        <div className="nav-section">
          <div className="nav-title">EXPLORE</div>

          <button
            className={`nav-item ${
              path === "/" ? "active" : ""
            }`}
            onClick={() => navigate("/")}
          >
            <span className="nav-icon">◉</span>
            <span>ARGO Network</span>
          </button>

          <button
            className={`nav-item ${
              path === "/4d" ? "active" : ""
            }`}
            onClick={() => navigate("/4d")}
          >
            <span className="nav-icon">◌</span>
            <span>4D Ocean Explorer</span>
          </button>

          <button
            className={`nav-item ${
              path === "/ai-query" ? "active" : ""
            }`}
            onClick={() => navigate("/ai-query")}
          >
            <span className="nav-icon sparkle">✦</span>
            <span>AI Ocean Query</span>
          </button>
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-data-card">
          <div className="data-card-top">
            <span className="online-dot" />
            <span>LIVE DATA</span>
          </div>

          <div className="data-card-title">
            Copernicus Marine
          </div>

          <div className="data-card-description">
            Real ocean observations and model data.
          </div>
        </div>

        <div className="sidebar-footer">
          <span>ORION FloatChat</span>
          <span>v1.0</span>
        </div>
      </div>
    </aside>
  );
}

/* =========================================================
   ARGO NETWORK
========================================================= */

function ArgoNetwork() {
  const [floats, setFloats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadFloats() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API}/argo?limit=50`);

        if (!response.ok) {
          throw new Error("Unable to retrieve ARGO network data.");
        }

        const data = await response.json();

        setFloats(data.floats || data.platforms || []);
      } catch (err) {
        console.error(err);
        setError(
          err.message || "Failed to load ARGO network."
        );
      } finally {
        setLoading(false);
      }
    }

    loadFloats();
  }, []);

  const filteredFloats = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return floats;

    return floats.filter((float) => {
      const text = [
        float.platform_id,
        float.wmo_platform_code,
        float.platform_type,
        float.institution,
        float.latitude,
        float.longitude,
        float.latest_time,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [floats, search]);

  const institutions = useMemo(() => {
    return new Set(
      floats
        .map((float) => float.institution)
        .filter(Boolean)
    ).size;
  }, [floats]);

  const latestObservation = useMemo(() => {
    const dates = floats
      .map((float) => float.latest_time)
      .filter(Boolean)
      .map((date) => new Date(date))
      .filter((date) => !Number.isNaN(date.getTime()));

    if (!dates.length) return null;

    return new Date(
      Math.max(...dates.map((date) => date.getTime()))
    );
  }, [floats]);

  const formatDate = (value) => {
    if (!value) return "No timestamp";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCoordinate = (value, positive, negative) => {
    const number = Number(value);

    if (!Number.isFinite(number)) return "--";

    return `${Math.abs(number).toFixed(2)}° ${
      number >= 0 ? positive : negative
    }`;
  };

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar />

        <main className="main-content argo-network-page">
          <div className="argo-loading-page">
            <div className="argo-loading-orb">
              <div />
            </div>

            <div>
              <span className="section-eyebrow">
                ORION · ARGO NETWORK
              </span>

              <h1>Connecting to the observation network</h1>

              <p>
                Retrieving real profiling-float metadata
                from Copernicus Marine...
              </p>

              <div className="argo-loading-line">
                <span />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Sidebar />

        <main className="main-content argo-network-page">
          <div className="argo-error-state">
            <div className="argo-error-icon">!</div>

            <div>
              <span className="section-eyebrow">
                ORION · DATA CONNECTION
              </span>

              <h1>Unable to load ARGO network</h1>

              <p>{error}</p>

              <button
                className="ocean-primary-button"
                onClick={() => window.location.reload()}
              >
                Retry connection
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content argo-network-page">

        {/* =================================================
            HERO
        ================================================= */}

        <section className="argo-hero">

          <div className="argo-hero-copy">

            <div className="argo-eyebrow">
              <span className="argo-live-dot" />
              ORION · OCEAN INTELLIGENCE
            </div>

            <div className="argo-title-row">
              <div>
                <h1>ARGO Observation Network</h1>

                <p>
                  Explore real profiling-float observations
                  retrieved from the Copernicus Marine
                  observation system.
                </p>
              </div>

              <div className="argo-real-badge">
                <span />
                REAL DATA
              </div>
            </div>

          </div>

          <div className="argo-hero-source">

            <span>DATA SOURCE</span>

            <strong>
              Copernicus Marine
            </strong>

            <small>
              Global in-situ observations
            </small>

          </div>

        </section>

        {/* =================================================
            NETWORK STATS
        ================================================= */}

        <section className="argo-stat-grid">

          <div className="argo-stat-card argo-stat-primary">
            <div className="argo-stat-icon">
              ◉
            </div>

            <div>
              <span>PROFILING FLOATS</span>

              <strong>
                {floats.length.toLocaleString()}
              </strong>

              <small>
                Currently loaded
              </small>
            </div>
          </div>

          <div className="argo-stat-card">
            <div className="argo-stat-icon">
              ◇
            </div>

            <div>
              <span>INSTITUTIONS</span>

              <strong>
                {institutions.toLocaleString()}
              </strong>

              <small>
                Represented in metadata
              </small>
            </div>
          </div>

          <div className="argo-stat-card">
            <div className="argo-stat-icon">
              ◎
            </div>

            <div>
              <span>LATEST OBSERVATION</span>

              <strong className="argo-date-value">
                {latestObservation
                  ? formatDate(latestObservation)
                  : "--"}
              </strong>

              <small>
                From loaded float metadata
              </small>
            </div>
          </div>

          <div className="argo-stat-card">
            <div className="argo-stat-icon">
              ◌
            </div>

            <div>
              <span>NETWORK STATUS</span>

              <strong className="argo-status-value">
                ONLINE
              </strong>

              <small>
                Copernicus source reachable
              </small>
            </div>
          </div>

        </section>

        {/* =================================================
            NETWORK OVERVIEW
        ================================================= */}

        <section className="argo-overview-card">

          <div className="argo-overview-visual">

            <div className="argo-radar">
              <div className="argo-radar-ring ring-one" />
              <div className="argo-radar-ring ring-two" />
              <div className="argo-radar-ring ring-three" />

              <div className="argo-radar-line" />

              <div className="argo-radar-center">
                <span />
              </div>

              {floats.slice(0, 12).map((float, index) => (
                <div
                  key={float.platform_id || index}
                  className="argo-radar-point"
                  style={{
                    left: `${18 + ((index * 37) % 64)}%`,
                    top: `${20 + ((index * 53) % 58)}%`,
                  }}
                />
              ))}
            </div>

          </div>

          <div className="argo-overview-copy">

            <span className="section-eyebrow">
              NETWORK OVERVIEW
            </span>

            <h2>
              Real ocean observations,
              organized for exploration.
            </h2>

            <p>
              Each entry below represents a profiling
              float identified in the Copernicus Marine
              observation metadata. Select a float to
              inspect its retrieved measurements,
              location and observation history.
            </p>

            <div className="argo-overview-points">

              <div>
                <span>01</span>

                <div>
                  <strong>
                    Real platform metadata
                  </strong>

                  <small>
                    IDs, institutions and latest
                    positions come from Copernicus.
                  </small>
                </div>
              </div>

              <div>
                <span>02</span>

                <div>
                  <strong>
                    Individual float exploration
                  </strong>

                  <small>
                    Open any platform to inspect
                    its real observations.
                  </small>
                </div>
              </div>

              <div>
                <span>03</span>

                <div>
                  <strong>
                    Connected to ORION
                  </strong>

                  <small>
                    Float observations can be
                    explored alongside the 4D ocean field.
                  </small>
                </div>
              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            SEARCH
        ================================================= */}

        <section className="argo-explorer-section">

          <div className="argo-section-heading">

            <div>
              <span className="section-eyebrow">
                ARGO EXPLORER
              </span>

              <h2>
                Browse profiling floats
              </h2>

              <p>
                Search by platform ID, WMO code,
                institution or observation metadata.
              </p>
            </div>

            <div className="argo-result-count">
              <strong>
                {filteredFloats.length}
              </strong>

              <span>
                matching platforms
              </span>
            </div>

          </div>

          <div className="argo-search-wrapper">

            <span className="argo-search-icon">
              ⌕
            </span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search platform, WMO code, institution..."
            />

            {search && (
              <button
                className="argo-clear-search"
                onClick={() => setSearch("")}
              >
                ×
              </button>
            )}

          </div>

          {/* =================================================
              FLOAT GRID
          ================================================= */}

          {filteredFloats.length ? (
            <div className="argo-float-grid">

              {filteredFloats.map((float, index) => {

                const platformId =
                  float.platform_id ||
                  float.id ||
                  float.wmo_platform_code;

                return (
                  <article
                    className="argo-float-card"
                    key={platformId || index}
                    onClick={() =>
                      (window.location.href =
                        `/float/${platformId}`)
                    }
                  >

                    <div className="argo-card-top">

                      <div className="argo-platform-mark">
                        <span />
                        PF
                      </div>

                      <span className="argo-card-live">
                        ACTIVE
                      </span>

                    </div>

                    <div className="argo-card-id">
                      <span>PLATFORM</span>

                      <strong>
                        {platformId || "--"}
                      </strong>
                    </div>

                    <div className="argo-card-institution">
                      <span>INSTITUTION</span>

                      <strong>
                        {float.institution ||
                          "Not specified"}
                      </strong>
                    </div>

                    <div className="argo-card-coordinates">

                      <div>
                        <span>LAT</span>

                        <strong>
                          {formatCoordinate(
                            float.latitude,
                            "N",
                            "S"
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>LON</span>

                        <strong>
                          {formatCoordinate(
                            float.longitude,
                            "E",
                            "W"
                          )}
                        </strong>
                      </div>

                    </div>

                    <div className="argo-card-footer">

                      <div>
                        <span>
                          LATEST OBSERVATION
                        </span>

                        <strong>
                          {formatDate(
                            float.latest_time
                          )}
                        </strong>
                      </div>

                      <span className="argo-explore-arrow">
                        →
                      </span>

                    </div>

                  </article>
                );
              })}

            </div>
          ) : (
            <div className="argo-empty-state">

              <div className="argo-empty-icon">
                ⌕
              </div>

              <h3>
                No matching platforms
              </h3>

              <p>
                Try searching for another platform
                ID, WMO code or institution.
              </p>

              <button
                className="reset-control"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>

            </div>
          )}

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="argo-network-footer">

          <div>
            <strong>
              ORION FloatChat
            </strong>

            <span>
              Ocean Informatics · ARGO observation
              intelligence
            </span>
          </div>

          <div>
            <span>DATA SOURCE</span>

            <strong>
              Copernicus Marine
            </strong>
          </div>

        </footer>

      </main>
    </div>
  );
}

/* =========================================================
   PLATFORM CARD
========================================================= */

function PlatformCard({ platform }) {
  const platformId =
    platform.platform_id ||
    platform.id ||
    platform.platformId ||
    "Unknown";

  const platformType =
    platform.platform_type ||
    platform.platformType ||
    platform.ptype ||
    "PF";

  const institution =
    platform.institution ||
    platform.organization ||
    null;

  const latitude =
    platform.latitude ??
    platform.lat ??
    null;

  const longitude =
    platform.longitude ??
    platform.lon ??
    null;

  return (
    <button
      className="platform-card"
      onClick={() => {
        window.location.href =
          `/float/${encodeURIComponent(platformId)}`;
      }}
    >
      <div className="platform-card-glow" />

      <div className="platform-card-top">
        <div className="platform-symbol">
          <span className="platform-pulse" />
          ◉
        </div>

        <div className="platform-type">
          {platformType}
        </div>
      </div>

      <div className="platform-id">
        {platformId}
      </div>

      <div className="platform-status">
        <span className="status-mini-dot" />
        REAL COPERNICUS PLATFORM
      </div>

      <div className="platform-institution">
        {institution || "Details available on inspection"}
      </div>

      <div className="platform-card-bottom">

        <div className="coordinate-group">
          <span className="coordinate-label">
            LAT
          </span>

          <span className="coordinate-value">
            {latitude !== null
              ? Number(latitude).toFixed(2)
              : "—"}
          </span>
        </div>

        <div className="coordinate-group">
          <span className="coordinate-label">
            LON
          </span>

          <span className="coordinate-value">
            {longitude !== null
              ? Number(longitude).toFixed(2)
              : "—"}
          </span>
        </div>

        <span className="card-arrow">
          →
        </span>
      </div>
    </button>
  );
}

/* =========================================================
   FLOAT EXPLORER
========================================================= */

function FloatExplorer({ platformId }) {
  const [floatData, setFloatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFloat() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API}/argo/${encodeURIComponent(platformId)}`
        );

        if (!response.ok) {
          throw new Error(
            `Backend returned ${response.status}`
          );
        }

        const data = await response.json();

        console.log("FLOAT RESPONSE:", data);

        setFloatData(data);
      } catch (err) {
        console.error("Float loading error:", err);

        setError(
          err.message ||
            "Unable to load float data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadFloat();
  }, [platformId]);

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar />

        <main className="main-content">
          <div className="loading-page">
            <div className="loading-spinner" />

            <div className="eyebrow">
              ARGO PROFILING FLOAT
            </div>

            <h2>Loading {platformId}</h2>

            <p>
              Retrieving real Copernicus Marine
              observations...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <Sidebar />

        <main className="main-content">

          <button
            className="back-button"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            ← Back to ARGO Network
          </button>

          <div className="error-card large">
            <div className="error-icon">!</div>

            <div className="error-content">
              <h2>Unable to load float</h2>
              <p>{error}</p>
            </div>
          </div>

        </main>
      </div>
    );
  }

  const observations =
    Array.isArray(floatData)
      ? floatData
      : floatData?.observations ||
        floatData?.data ||
        [];

  const temperatures = observations
    .filter(
      (row) =>
        String(row.variable || "")
          .toUpperCase()
          .includes("TEMP") &&
        Number.isFinite(Number(row.value))
    )
    .map((row) => Number(row.value));

  const salinity = observations
    .filter(
      (row) =>
        String(row.variable || "")
          .toUpperCase()
          .includes("PSAL") &&
        Number.isFinite(Number(row.value))
    )
    .map((row) => Number(row.value));

  const mean = (values) => {
    if (!values.length) return "—";

    return (
      values.reduce((a, b) => a + b, 0) /
      values.length
    ).toFixed(2);
  };

  const latest =
    observations.length > 0
      ? observations[0]
      : {};

  const latitude =
    floatData?.latitude ??
    latest.latitude ??
    null;

  const longitude =
    floatData?.longitude ??
    latest.longitude ??
    null;

  const institution =
    floatData?.institution ??
    latest.institution ??
    "Copernicus Marine";

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content">

        <button
          className="back-button"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          ← Back to ARGO Network
        </button>

        <header className="page-header float-header">
          <div className="header-copy">

            <div className="eyebrow">
              ARGO PROFILING FLOAT
            </div>

            <h1>{platformId}</h1>

            <p>
              Real observations retrieved from
              Copernicus Marine.
            </p>
          </div>

          <div className="live-badge">
            <span className="live-badge-dot" />
            REAL DATA
          </div>
        </header>

        <section className="float-overview">

          <div className="float-location-card">
            <div className="location-card-label">
              CURRENT / LATEST LOCATION
            </div>

            <div className="location-coordinates">
              {latitude !== null
                ? `${Number(latitude).toFixed(3)}°`
                : "—"}
              <span> LAT</span>

              <strong> · </strong>

              {longitude !== null
                ? `${Number(longitude).toFixed(3)}°`
                : "—"}
              <span> LON</span>
            </div>

            <div className="location-meta">
              <span className="status-mini-dot" />
              Real observation metadata
            </div>
          </div>

          <div className="float-info-card">
            <div className="info-card-label">
              PLATFORM
            </div>

            <strong>{platformId}</strong>

            <span>
              {institution}
            </span>
          </div>

        </section>

        <section className="stats-grid">

          <StatCard
            icon="⌁"
            label="OBSERVATIONS"
            value={observations.length}
          />

          <StatCard
            icon="°"
            label="TEMPERATURE"
            value={
              temperatures.length
                ? `${mean(temperatures)} °C`
                : "—"
            }
          />

          <StatCard
            icon="≈"
            label="SALINITY"
            value={
              salinity.length
                ? `${mean(salinity)} PSU`
                : "—"
            }
          />

        </section>

        <section className="data-panel">

          <div className="panel-heading">

            <div>
              <div className="section-eyebrow">
                OBSERVATION DATA
              </div>

              <h2>Float measurements</h2>

              <p>
                Real measurements returned by
                Copernicus Marine.
              </p>
            </div>

            <span className="data-source-pill">
              ● Copernicus Marine
            </span>

          </div>

          {observations.length === 0 ? (
            <div className="empty-state compact">
              <h2>No observations returned</h2>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">

                <thead>
                  <tr>
                    <th>VARIABLE</th>
                    <th>TIME</th>
                    <th>LATITUDE</th>
                    <th>LONGITUDE</th>
                    <th>DEPTH</th>
                    <th>VALUE</th>
                  </tr>
                </thead>

                <tbody>
                  {observations
                    .slice(0, 100)
                    .map((row, index) => (
                      <tr key={index}>

                        <td>
                          <span className="variable-badge">
                            {row.variable || "—"}
                          </span>
                        </td>

                        <td>
                          {row.time || "—"}
                        </td>

                        <td>
                          {row.latitude ?? "—"}
                        </td>

                        <td>
                          {row.longitude ?? "—"}
                        </td>

                        <td>
                          {row.depth ?? "—"}
                        </td>

                        <td className="value-cell">
                          {row.value ?? "—"}
                        </td>

                      </tr>
                    ))}
                </tbody>

              </table>
            </div>
          )}

        </section>

        <footer className="page-footer">
          <span>
            Real Copernicus Marine observations
          </span>
        </footer>

      </main>
    </div>
  );
}

/* =========================================================
   AI OCEAN QUERY
========================================================= */

function AIOceanQuery() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function runQuery(customQuery) {
    const text = (
      customQuery !== undefined
        ? customQuery
        : query
    ).trim();

    if (!text) return;

    setQuery(text);
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const lower = text.toLowerCase();

      let latitude = null;
      let longitude = null;

      let region =
        "Indian Ocean — Copernicus ocean grid";

      if (
        lower.includes("chennai") ||
        lower.includes("madras")
      ) {
        latitude = 13.08;
        longitude = 80.27;

        region =
          "Chennai, India — Copernicus ocean grid";
      } else if (
        lower.includes("tamil nadu")
      ) {
        latitude = 11.13;
        longitude = 78.66;

        region =
          "Tamil Nadu region — Copernicus ocean grid";
      } else if (
        lower.includes("bay of bengal")
      ) {
        latitude = 13.0;
        longitude = 85.0;

        region =
          "Bay of Bengal — Copernicus ocean grid";
      }

      const depthMatch = lower.match(
        /(\d+(?:\.\d+)?)\s*(m|meter|meters|metre|metres)\b/
      );

      const requestedDepth = depthMatch
        ? Number(depthMatch[1])
        : null;

      const url = new URL(
        `${API}/ocean-4d`
      );

      if (requestedDepth !== null) {
        url.searchParams.set(
          "depth",
          requestedDepth
        );
      }

      if (
        latitude !== null &&
        longitude !== null
      ) {
        url.searchParams.set(
          "latitude",
          latitude
        );

        url.searchParams.set(
          "longitude",
          longitude
        );
      }

      const response = await fetch(
        url.toString()
      );

      if (!response.ok) {
        throw new Error(
          `Ocean data request failed: ${response.status}`
        );
      }

      const data = await response.json();

      const points =
        Array.isArray(data.points)
          ? data.points
          : Array.isArray(data.observations)
          ? data.observations
          : [];

      const values = points
        .map((point) =>
          Number(
            point.value ??
              point.temperature ??
              point.thetao
          )
        )
        .filter(Number.isFinite);

      if (!values.length) {
        throw new Error(
          "No valid Copernicus ocean values were returned for this query."
        );
      }

      const average =
        values.reduce(
          (sum, value) => sum + value,
          0
        ) / values.length;

      const minimum = Math.min(...values);
      const maximum = Math.max(...values);

      setResult({
        region,
        requestedDepth,
        actualDepth:
          data?.actual_data_depth ??
          data?.depth ??
          null,
        average,
        minimum,
        maximum,
        count: values.length,
        source:
          data?.source ||
          "Copernicus Marine",
        dataset:
          data?.dataset ||
          "Copernicus Marine dataset",
        variable:
          data?.variable ||
          "thetao",
        units:
          data?.units ||
          "°C",
        requestedLocation:
          data?.requested_location ||
          null,
        actualLocation:
          data?.actual_data_location ||
          null,
      });
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to process the ocean query."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content ai-page">

        <section className="ai-hero">

          <div className="ai-hero-badge">
            <span>✦</span>
            AI OCEAN INTELLIGENCE
          </div>

          <h1>
            Ask the ocean.
            <br />
            <span>ORION finds the data.</span>
          </h1>

          <p>
            Ask questions in natural language and
            explore real Copernicus Marine data.
          </p>

        </section>

        <section className="query-card">

          <div className="query-label">
            ASK ORION
          </div>

          <div className="query-input-row">

            <div className="query-input-wrap">
              <span>⌕</span>

              <input
                value={query}
                onChange={(e) =>
                  setQuery(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    runQuery();
                  }
                }}
                placeholder="Ask about temperature, location or depth..."
              />
            </div>

            <button
              className="query-button"
              onClick={() => runQuery()}
              disabled={loading}
            >
              {loading
                ? "Analyzing..."
                : "Run Query →"}
            </button>

          </div>

          <div className="suggestion-row">

            <button
              onClick={() =>
                runQuery(
                  "Chennai temperature at 50m"
                )
              }
            >
              Chennai · 50m
            </button>

            <button
              onClick={() =>
                runQuery(
                  "Chennai surface temperature"
                )
              }
            >
              Chennai · Surface
            </button>

            <button
              onClick={() =>
                runQuery(
                  "Bay of Bengal temperature at 50m"
                )
              }
            >
              Bay of Bengal · 50m
            </button>

          </div>

        </section>

        {error && (
          <div className="error-card">
            <div className="error-icon">!</div>

            <div className="error-content">
              <strong>
                Query could not be completed
              </strong>

              <p>{error}</p>
            </div>
          </div>
        )}

        {result && (
          <section className="ai-results">

            <div className="result-header">

              <div>
                <div className="section-eyebrow">
                  REAL DATA RESULT
                </div>

                <h2>
                  Temperature analysis
                </h2>
              </div>

              <div className="verified-badge">
                ✓ VERIFIED DATA
              </div>

            </div>

            <div className="result-metrics">

              <MetricBox
                label="AVERAGE"
                value={`${result.average.toFixed(2)}°C`}
              />

              <MetricBox
                label="MINIMUM"
                value={`${result.minimum.toFixed(2)}°C`}
              />

              <MetricBox
                label="MAXIMUM"
                value={`${result.maximum.toFixed(2)}°C`}
              />

              <MetricBox
                label="DATA POINTS"
                value={result.count}
              />

            </div>

            <div className="interpretation-grid">

              <InfoBox
                title="REGION"
                value={result.region}
              />

              <InfoBox
                title="DEPTH"
                value={
                  result.actualDepth !== null
                    ? `Nearest available depth · ${Number(
                        result.actualDepth
                      ).toFixed(1)} m`
                    : result.requestedDepth !== null
                    ? `${result.requestedDepth} m`
                    : "Surface / shallow ocean"
                }
              />

              <InfoBox
                title="VARIABLE"
                value="Sea Water Temperature"
              />

              <InfoBox
                title="SOURCE"
                value={result.source}
              />

            </div>

            {result.actualLocation && (
              <div className="location-panel">

                <div className="location-panel-icon">
                  ◉
                </div>

                <div>
                  <div className="section-eyebrow">
                    ACTUAL DATA LOCATION
                  </div>

                  <div className="location-value">
                    {Number(
                      result.actualLocation.latitude
                    ).toFixed(3)}
                    °N

                    <span> / </span>

                    {Number(
                      result.actualLocation.longitude
                    ).toFixed(3)}
                    °E
                  </div>
                </div>

              </div>
            )}

            <div className="source-panel">

              <div>
                <div className="section-eyebrow">
                  DATA SOURCE
                </div>

                <h3>
                  Copernicus Marine
                </h3>

                <p>
                  {result.dataset}
                </p>

                <span>
                  Variable: {result.variable}
                </span>
              </div>

              <div className="source-check">
                <span>✓</span>
                REAL DATA
              </div>

            </div>

            <div className="explain-panel">

              <div className="explain-icon">
                ✦
              </div>

              <div>
                <div className="section-eyebrow">
                  HOW ORION ANSWERED
                </div>

                <p>
                  ORION interpreted the location and
                  depth from your question, retrieved
                  the corresponding real Copernicus
                  Marine ocean grid, and calculated
                  the displayed statistics from the
                  returned values.
                </p>
              </div>

            </div>

            <button
              className="open-4d-button"
              onClick={() => {
                const params =
                  new URLSearchParams();

                if (
                  result.requestedDepth !==
                  null
                ) {
                  params.set(
                    "depth",
                    result.requestedDepth
                  );
                }

                if (
                  result.requestedLocation
                ) {
                  params.set(
                    "latitude",
                    result.requestedLocation.latitude
                  );

                  params.set(
                    "longitude",
                    result.requestedLocation.longitude
                  );
                }

                window.location.href =
                  `/4d?${params.toString()}`;
              }}
            >
              Open result in 4D Ocean Explorer →
            </button>

          </section>
        )}

      </main>
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function StatCard({
  icon,
  label,
  value,
  source = false,
}) {
  return (
    <div className="stat-card">

      <div className="stat-icon">
        {icon}
      </div>

      <div className="stat-content">

        <div className="stat-label">
          {label}
        </div>

        <div
          className={
            source
              ? "stat-source"
              : "stat-value"
          }
        >
          {value}
        </div>

      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="metric-box">

      <div className="metric-label">
        {label}
      </div>

      <div className="metric-value">
        {value}
      </div>

    </div>
  );
}

function InfoBox({ title, value }) {
  return (
    <div className="info-box">

      <div className="info-title">
        {title}
      </div>

      <div className="info-value">
        {value}
      </div>

    </div>
  );
}

export default App;