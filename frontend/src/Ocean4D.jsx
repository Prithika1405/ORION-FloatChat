import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const API = "http://127.0.0.1:8000";

/* =========================================================
   TEMPERATURE COLOR
========================================================= */

function temperatureColor(value, min, max) {
  const normalized =
    max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));

  const color = new THREE.Color();

  // Cold → cyan → yellow → warm red
  color.setHSL(0.62 - normalized * 0.62, 0.9, 0.52);

  return color;
}

/* =========================================================
   FLOATING PARTICLES
========================================================= */

function AmbientParticles() {
  const ref = useRef();

  const particles = useMemo(() => {
    const arr = [];

    for (let i = 0; i < 180; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 18,
        y: (Math.random() - 0.5) * 9,
        z: (Math.random() - 0.5) * 15,
        speed: 0.0005 + Math.random() * 0.0015,
      });
    }

    return arr;
  }, []);

  useFrame(() => {
    if (!ref.current) return;

    ref.current.rotation.y += 0.00015;
  });

  return (
    <group ref={ref}>
      {particles.map((particle, index) => (
        <mesh
          key={index}
          position={[particle.x, particle.y, particle.z]}
        >
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial
            color="#5ee7ff"
            transparent
            opacity={0.18}
          />
        </mesh>
      ))}
    </group>
  );
}

/* =========================================================
   OCEAN DATA POINTS
========================================================= */

function OceanPoints({
  observations,
  selectedTime,
  selectedDepth,
}) {
  const visiblePoints = useMemo(() => {
    if (!observations?.length) return [];

    let filtered = observations;

    if (selectedTime !== "all") {
      filtered = filtered.filter(
        (point) => String(point.time) === String(selectedTime)
      );
    }

    if (selectedDepth !== "all") {
      const targetDepth = Number(selectedDepth);

      filtered = filtered.filter(
        (point) =>
          Math.abs(Number(point.depth) - targetDepth) < 15
      );
    }

    return filtered.slice(0, 7000);
  }, [observations, selectedTime, selectedDepth]);

  const { positions, colors } = useMemo(() => {
    const pos = [];
    const col = [];

    if (!visiblePoints.length) {
      return {
        positions: new Float32Array(),
        colors: new Float32Array(),
      };
    }

    const values = visiblePoints
      .map((point) => Number(point.value))
      .filter(Number.isFinite);

    const min = Math.min(...values);
    const max = Math.max(...values);

    visiblePoints.forEach((point) => {
      const lat = Number(point.latitude);
      const lon = Number(point.longitude);
      const depth = Number(point.depth);
      const value = Number(point.value);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        !Number.isFinite(depth) ||
        !Number.isFinite(value)
      ) {
        return;
      }

      /*
       * Geographic → visual coordinates
       *
       * X = longitude
       * Z = latitude
       * Y = depth
       */

      const x = (lon - 80) * 1.6;
      const z = (lat - 11) * 1.6;

      const y = -(depth / 30);

      pos.push(x, y, z);

      const color = temperatureColor(value, min, max);

      col.push(color.r, color.g, color.b);
    });

    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col),
    };
  }, [visiblePoints]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />

        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>

      <pointsMaterial
        size={0.075}
        vertexColors
        transparent
        opacity={0.95}
        sizeAttenuation
      />
    </points>
  );
}

/* =========================================================
   3D OCEAN SCENE
========================================================= */

function OceanScene({
  observations,
  selectedTime,
  selectedDepth,
}) {
  return (
    <>
      <ambientLight intensity={0.65} />

      <directionalLight
        position={[5, 8, 5]}
        intensity={1.1}
      />

      {/* Horizontal reference plane */}
      <gridHelper
        args={[18, 24, "#16404d", "#0c252e"]}
        position={[0, -0.03, 0]}
      />

      {/* Vertical depth reference */}
      <gridHelper
        args={[18, 18, "#102f39", "#0b2028"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, -3, 0]}
      />

      <OceanPoints
        observations={observations}
        selectedTime={selectedTime}
        selectedDepth={selectedDepth}
      />

      <AmbientParticles />

      <Text
        position={[0, 0.25, -7]}
        fontSize={0.28}
        color="#7eeeff"
        anchorX="center"
        anchorY="middle"
      >
        SURFACE
      </Text>

      <Text
        position={[-6.2, -2.5, 0]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.22}
        color="#5f8f9c"
        anchorX="center"
        anchorY="middle"
      >
        DEPTH
      </Text>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={3.5}
        maxDistance={24}
        maxPolarAngle={Math.PI * 0.84}
      />
    </>
  );
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatTemp(value) {
  if (value === null || value === undefined) return "--";

  return `${Number(value).toFixed(2)}°C`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "--";

  return Number(value).toLocaleString();
}

/* =========================================================
   TEMPERATURE DISTRIBUTION
========================================================= */

function TemperatureDistribution({ points }) {
  const distribution = useMemo(() => {
    const values = points
      .map((point) => Number(point.value))
      .filter(Number.isFinite);

    if (!values.length) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);

    const bucketCount = 7;

    if (min === max) {
      return [
        {
          label: min.toFixed(1),
          count: values.length,
        },
      ];
    }

    const step = (max - min) / bucketCount;

    const buckets = Array.from(
      { length: bucketCount },
      (_, index) => ({
        label: `${(min + index * step).toFixed(1)}°`,
        count: 0,
      })
    );

    values.forEach((value) => {
      let index = Math.floor((value - min) / step);

      if (index >= bucketCount) {
        index = bucketCount - 1;
      }

      buckets[index].count += 1;
    });

    return buckets;
  }, [points]);

  const maxCount = Math.max(
    ...distribution.map((bucket) => bucket.count),
    1
  );

  if (!distribution.length) {
    return (
      <div className="distribution-empty">
        No temperature values available for this selection.
      </div>
    );
  }

  return (
    <div className="distribution-chart">
      {distribution.map((bucket, index) => {
        const height =
          bucket.count === 0
            ? 3
            : Math.max(
                8,
                (bucket.count / maxCount) * 100
              );

        return (
          <div
            className="distribution-column"
            key={index}
          >
            <div className="distribution-value">
              {bucket.count}
            </div>

            <div className="distribution-bar-track">
              <div
                className="distribution-bar"
                style={{
                  height: `${height}%`,
                }}
              />
            </div>

            <div className="distribution-label">
              {bucket.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Ocean4D() {
  const [observations, setObservations] = useState([]);
  const [metadata, setMetadata] = useState(null);

  const [selectedTime, setSelectedTime] = useState("all");
  const [selectedDepth, setSelectedDepth] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* -------------------------------------------------------
     LOAD REAL COPERNICUS DATA
  ------------------------------------------------------- */

  useEffect(() => {
    async function loadOceanData() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API}/ocean-4d`
        );

        if (!response.ok) {
          throw new Error(
            "Unable to retrieve Copernicus Marine data."
          );
        }

        const data = await response.json();

        setObservations(data.points || []);
        setMetadata(data);
      } catch (err) {
        console.error(err);

        setError(
          err.message ||
            "Failed to load ocean data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadOceanData();
  }, []);

  /* -------------------------------------------------------
     TIME VALUES
  ------------------------------------------------------- */

  const timeValues = useMemo(() => {
    return [
      ...new Set(
        observations
          .map((point) => point.time)
          .filter(Boolean)
          .map(String)
      ),
    ];
  }, [observations]);

  /* -------------------------------------------------------
     DEPTH VALUES
  ------------------------------------------------------- */

  const depthValues = useMemo(() => {
    return [
      ...new Set(
        observations
          .map((point) => Number(point.depth))
          .filter(Number.isFinite)
      ),
    ].sort((a, b) => a - b);
  }, [observations]);

  /* -------------------------------------------------------
     CURRENT FILTERED DATA
  ------------------------------------------------------- */

  const currentPoints = useMemo(() => {
    let result = observations;

    if (selectedTime !== "all") {
      result = result.filter(
        (point) =>
          String(point.time) === String(selectedTime)
      );
    }

    if (selectedDepth !== "all") {
      const target = Number(selectedDepth);

      result = result.filter(
        (point) =>
          Math.abs(Number(point.depth) - target) < 15
      );
    }

    return result;
  }, [
    observations,
    selectedTime,
    selectedDepth,
  ]);

  /* -------------------------------------------------------
     STATISTICS
  ------------------------------------------------------- */

  const statistics = useMemo(() => {
    const values = currentPoints
      .map((point) => Number(point.value))
      .filter(Number.isFinite);

    if (!values.length) {
      return {
        min: null,
        mean: null,
        max: null,
        range: null,
      };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    const mean =
      values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length;

    return {
      min,
      mean,
      max,
      range: max - min,
    };
  }, [currentPoints]);

  /* -------------------------------------------------------
     ACTUAL COPERNICUS DEPTH
  ------------------------------------------------------- */

  const actualDepth = useMemo(() => {
    if (selectedDepth === "all") return null;

    const target = Number(selectedDepth);

    if (!depthValues.length) return null;

    return depthValues.reduce(
      (closest, depth) =>
        Math.abs(depth - target) <
        Math.abs(closest - target)
          ? depth
          : closest
    );
  }, [selectedDepth, depthValues]);

  /* -------------------------------------------------------
     DATA COVERAGE
  ------------------------------------------------------- */

  const coverage = useMemo(() => {
    const valid = currentPoints.filter(
      (point) =>
        Number.isFinite(Number(point.latitude)) &&
        Number.isFinite(Number(point.longitude))
    );

    if (!valid.length) {
      return null;
    }

    const latitudes = valid.map((p) =>
      Number(p.latitude)
    );

    const longitudes = valid.map((p) =>
      Number(p.longitude)
    );

    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLon: Math.min(...longitudes),
      maxLon: Math.max(...longitudes),
    };
  }, [currentPoints]);

  /* -------------------------------------------------------
     EXPLANATION TEXT
  ------------------------------------------------------- */

  const explanation = useMemo(() => {
    if (!currentPoints.length) {
      return "No observations match the current selection.";
    }

    const depthText =
      actualDepth !== null
        ? `approximately ${actualDepth} metres`
        : "the available depth range";

    return `This view contains ${currentPoints.length.toLocaleString()} real Copernicus Marine observations at ${depthText}. The displayed temperature values range from ${statistics.min?.toFixed(
      2
    )}°C to ${statistics.max?.toFixed(
      2
    )}°C, with an average of ${statistics.mean?.toFixed(
      2
    )}°C.`;
  }, [
    currentPoints,
    actualDepth,
    statistics,
  ]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="ocean4d-page ocean4d-loading-page">
        <div className="loading-orb">
          <div className="loading-orb-inner" />
        </div>

        <div className="loading-content">
          <div className="loading-eyebrow">
            ORION · OCEAN INTELLIGENCE
          </div>

          <h1>Building the ocean field</h1>

          <p>
            Retrieving real Copernicus Marine
            data...
          </p>

          <div className="loading-line">
            <span />
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error) {
    return (
      <div className="ocean4d-page ocean4d-loading-page">
        <div className="error-panel">
          <div className="error-icon">!</div>

          <div>
            <div className="loading-eyebrow">
              ORION · DATA CONNECTION
            </div>

            <h1>
              Unable to load ocean data
            </h1>

            <p>{error}</p>

            <button
              className="ocean-primary-button"
              onClick={() =>
                window.location.reload()
              }
            >
              Retry connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="ocean4d-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="ocean4d-header">

        <div className="ocean-header-brand">
          <button
            className="back-button"
            onClick={() =>
              (window.location.href = "/")
            }
          >
            ←
          </button>

          <div>
            <div className="loading-eyebrow">
              ORION · OCEAN INTELLIGENCE
            </div>

            <div className="ocean-title-line">
              <h1>4D Ocean Explorer</h1>

              <span className="real-badge">
                <span className="real-dot" />
                REAL COPERNICUS DATA
              </span>
            </div>

            <p>
              Explore temperature across
              geographic position, depth and
              time using retrieved ocean data.
            </p>
          </div>
        </div>

        <div className="header-source-card">
          <span>DATA SOURCE</span>

          <strong>
            Copernicus Marine
          </strong>

          <small>
            {metadata?.variable || "thetao"}
            {" · "}
            {metadata?.units || "°C"}
          </small>
        </div>

      </header>

      {/* =====================================================
          HERO VISUALIZATION
      ===================================================== */}

      <section className="ocean4d-hero">

        <div className="hero-visual">

          <div className="hero-topbar">
            <div>
              <span>
                3D SPATIAL FIELD
              </span>

              <h2>
                Sea Water Temperature
              </h2>
            </div>

            <div className="hero-point-count">
              <strong>
                {formatNumber(
                  currentPoints.length
                )}
              </strong>

              <span>
                observations visible
              </span>
            </div>
          </div>

          <div className="ocean-canvas">

            <Canvas
              camera={{
                position: [0, 5.5, 10],
                fov: 48,
              }}
            >
              <OceanScene
                observations={observations}
                selectedTime={selectedTime}
                selectedDepth={selectedDepth}
              />
            </Canvas>

            <div className="canvas-overlay-label">
              <span className="pulse-dot" />
              COPERNICUS OCEAN FIELD
            </div>

            <div className="canvas-axis-info">
              <span>
                X · Longitude
              </span>

              <span>
                Y · Depth
              </span>

              <span>
                Z · Latitude
              </span>
            </div>

            <div className="canvas-help">
              <strong>Drag</strong> rotate
              <strong>Scroll</strong> zoom
            </div>

            <div className="temperature-legend-large">

              <div className="legend-heading">
                TEMPERATURE
              </div>

              <div className="legend-gradient-large" />

              <div className="legend-scale">
                <span>Cold</span>
                <span>Warm</span>
              </div>

            </div>

          </div>

        </div>

        {/* ===================================================
            RIGHT INSIGHT PANEL
        =================================================== */}

        <aside className="ocean-insight-panel">

          <div className="insight-header">
            <span>
              LIVE DATA INSIGHT
            </span>

            <div className="insight-status">
              <span />
              Calculated
            </div>
          </div>

          <div className="primary-temperature">
            <span>MEAN TEMPERATURE</span>

            <strong>
              {formatTemp(statistics.mean)}
            </strong>

            <small>
              Across the current selection
            </small>
          </div>

          <div className="insight-grid">

            <div>
              <span>MINIMUM</span>
              <strong>
                {formatTemp(statistics.min)}
              </strong>
            </div>

            <div>
              <span>MAXIMUM</span>
              <strong>
                {formatTemp(statistics.max)}
              </strong>
            </div>

            <div>
              <span>RANGE</span>
              <strong>
                {statistics.range !== null
                  ? `${statistics.range.toFixed(
                      2
                    )}°C`
                  : "--"}
              </strong>
            </div>

            <div>
              <span>OBSERVATIONS</span>
              <strong>
                {formatNumber(
                  currentPoints.length
                )}
              </strong>
            </div>

          </div>

          <div className="insight-divider" />

          <div className="selection-summary">

            <span className="summary-label">
              CURRENT VIEW
            </span>

            <div className="summary-row">
              <span>Time</span>

              <strong>
                {selectedTime === "all"
                  ? "All available"
                  : selectedTime}
              </strong>
            </div>

            <div className="summary-row">
              <span>Requested depth</span>

              <strong>
                {selectedDepth === "all"
                  ? "All depths"
                  : `${selectedDepth} m`}
              </strong>
            </div>

            <div className="summary-row">
              <span>Actual level</span>

              <strong>
                {actualDepth !== null
                  ? `${actualDepth} m`
                  : "All available"}
              </strong>
            </div>

          </div>

        </aside>

      </section>

      {/* =====================================================
          CONTROLS
      ===================================================== */}

      <section className="explorer-controls">

        <div className="section-heading-row">

          <div>
            <span className="section-eyebrow">
              EXPLORATION CONTROLS
            </span>

            <h2>
              Navigate the ocean field
            </h2>
          </div>

          <button
            className="reset-control"
            onClick={() => {
              setSelectedTime("all");
              setSelectedDepth("all");
            }}
          >
            ↺ Reset filters
          </button>

        </div>

        <div className="control-grid">

          {/* TIME */}

          <div className="control-card">

            <div className="control-top">

              <div className="control-icon">
                ◷
              </div>

              <div>
                <span>TIME</span>

                <strong>
                  {selectedTime === "all"
                    ? "All available"
                    : selectedTime}
                </strong>
              </div>

            </div>

            {timeValues.length > 1 ? (
              <>
                <input
                  className="modern-range"
                  type="range"
                  min="0"
                  max={timeValues.length - 1}
                  value={
                    selectedTime === "all"
                      ? 0
                      : Math.max(
                          0,
                          timeValues.indexOf(
                            selectedTime
                          )
                        )
                  }
                  onChange={(event) =>
                    setSelectedTime(
                      timeValues[
                        Number(event.target.value)
                      ]
                    )
                  }
                />

                <div className="range-endpoints">
                  <span>
                    {timeValues[0]}
                  </span>

                  <span>
                    {
                      timeValues[
                        timeValues.length - 1
                      ]
                    }
                  </span>
                </div>
              </>
            ) : (
              <div className="control-static">
                {timeValues[0] ||
                  "Single available time"}
              </div>
            )}

          </div>

          {/* DEPTH */}

          <div className="control-card">

            <div className="control-top">

              <div className="control-icon">
                ↓
              </div>

              <div>
                <span>DEPTH</span>

                <strong>
                  {selectedDepth === "all"
                    ? "All depths"
                    : `${actualDepth ?? selectedDepth} m`}
                </strong>
              </div>

            </div>

            {depthValues.length ? (
              <>
                <input
                  className="modern-range"
                  type="range"
                  min="0"
                  max={depthValues.length - 1}
                  value={
                    selectedDepth === "all"
                      ? 0
                      : Math.max(
                          0,
                          depthValues.findIndex(
                            (depth) =>
                              Number(depth) ===
                              Number(
                                selectedDepth
                              )
                          )
                        )
                  }
                  onChange={(event) => {
                    const value =
                      depthValues[
                        Number(event.target.value)
                      ];

                    setSelectedDepth(
                      String(value)
                    );
                  }}
                />

                <div className="range-endpoints">
                  <span>
                    {depthValues[0]} m
                  </span>

                  <span>
                    {
                      depthValues[
                        depthValues.length - 1
                      ]
                    }{" "}
                    m
                  </span>
                </div>

                {actualDepth !== null && (
                  <div className="control-note">
                    Requested{" "}
                    <strong>
                      {selectedDepth} m
                    </strong>
                    {" → "}
                    Copernicus level{" "}
                    <strong>
                      {actualDepth} m
                    </strong>
                  </div>
                )}
              </>
            ) : (
              <div className="control-static">
                No depth levels available
              </div>
            )}

          </div>

        </div>

      </section>

      {/* =====================================================
          DATA STORY
      ===================================================== */}

      <section className="data-story-section">

        <div className="section-heading-row">

          <div>
            <span className="section-eyebrow">
              DATA STORY
            </span>

            <h2>
              What does this view show?
            </h2>
          </div>

          <span className="analysis-status">
            Derived from retrieved observations
          </span>

        </div>

        <div className="data-story-grid">

          {/* EXPLANATION */}

          <div className="explanation-card">

            <div className="explanation-icon">
              ✦
            </div>

            <div>

              <h3>
                Interpreting the field
              </h3>

              <p>
                {explanation}
              </p>

              <div className="method-list">

                <div>
                  <span>01</span>
                  <p>
                    Each rendered point represents
                    a value retrieved from the
                    Copernicus ocean dataset.
                  </p>
                </div>

                <div>
                  <span>02</span>
                  <p>
                    Color encodes the relative
                    temperature value within the
                    current visible selection.
                  </p>
                </div>

                <div>
                  <span>03</span>
                  <p>
                    Statistics are calculated from
                    the retrieved values rather than
                    manually entered.
                  </p>
                </div>

              </div>

            </div>

          </div>

          {/* COVERAGE */}

          <div className="coverage-card">

            <span className="section-eyebrow">
              SPATIAL COVERAGE
            </span>

            <h3>
              Geographic extent
            </h3>

            {coverage ? (
              <div className="coverage-grid">

                <div>
                  <span>Latitude</span>

                  <strong>
                    {coverage.minLat.toFixed(
                      2
                    )}
                    °
                    {" → "}
                    {coverage.maxLat.toFixed(
                      2
                    )}
                    °
                  </strong>
                </div>

                <div>
                  <span>Longitude</span>

                  <strong>
                    {coverage.minLon.toFixed(
                      2
                    )}
                    °
                    {" → "}
                    {coverage.maxLon.toFixed(
                      2
                    )}
                    °
                  </strong>
                </div>

              </div>
            ) : (
              <p>
                Geographic coverage is unavailable
                for this selection.
              </p>
            )}

          </div>

        </div>

      </section>

      {/* =====================================================
          TEMPERATURE DISTRIBUTION
      ===================================================== */}

      <section className="distribution-section">

        <div className="section-heading-row">

          <div>
            <span className="section-eyebrow">
              DISTRIBUTION
            </span>

            <h2>
              Where do the temperatures fall?
            </h2>
          </div>

          <span className="analysis-status">
            {currentPoints.length.toLocaleString()}{" "}
            observations
          </span>

        </div>

        <div className="distribution-card">

          <div className="distribution-header">

            <div>
              <strong>
                Temperature distribution
              </strong>

              <span>
                Frequency of retrieved values
              </span>
            </div>

            <div className="distribution-range">
              {formatTemp(statistics.min)}
              {" — "}
              {formatTemp(statistics.max)}
            </div>

          </div>

          <TemperatureDistribution
            points={currentPoints}
          />

          <div className="chart-explanation">
            <span>HOW TO READ THIS</span>

            <p>
              Taller bars indicate that more
              retrieved observations fall within
              that temperature interval. This chart
              is calculated directly from the current
              filtered Copernicus dataset.
            </p>
          </div>

        </div>

      </section>

      {/* =====================================================
          DATA PROVENANCE
      ===================================================== */}

      <section className="provenance-section">

        <div className="provenance-card">

          <div className="provenance-main">

            <div className="provenance-symbol">
              ◈
            </div>

            <div>

              <span className="section-eyebrow">
                DATA PROVENANCE
              </span>

              <h3>
                Why can this visualization be
                trusted?
              </h3>

              <p>
                The values shown in this explorer
                originate from the Copernicus Marine
                dataset retrieved by the ORION backend.
                The browser filters and summarizes
                those retrieved observations for
                visualization.
              </p>

            </div>

          </div>

          <div className="provenance-checks">

            <div>
              <span>✓</span>
              <strong>
                Copernicus Marine
              </strong>
            </div>

            <div>
              <span>✓</span>
              <strong>
                Variable:{" "}
                {metadata?.variable ||
                  "thetao"}
              </strong>
            </div>

            <div>
              <span>✓</span>
              <strong>
                Units:{" "}
                {metadata?.units || "°C"}
              </strong>
            </div>

            <div>
              <span>✓</span>
              <strong>
                Real retrieved observations
              </strong>
            </div>

          </div>

        </div>

        <div className="dataset-technical">

          <div>
            <span>DATASET</span>

            <strong>
              {metadata?.dataset ||
                "Copernicus Marine Dataset"}
            </strong>
          </div>

          <div>
            <span>VARIABLE</span>

            <strong>
              {metadata?.variable ||
                "thetao"}
            </strong>
          </div>

          <div>
            <span>POINTS RETRIEVED</span>

            <strong>
              {formatNumber(
                observations.length
              )}
            </strong>
          </div>

          <div>
            <span>VISIBLE</span>

            <strong>
              {formatNumber(
                currentPoints.length
              )}
            </strong>
          </div>

        </div>

      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="ocean4d-footer">

        <span className="footer-brand">
          ORION FloatChat
        </span>

        <span>•</span>

        <span>
          Ocean Informatics · Real Copernicus
          Marine Data
        </span>

      </footer>

    </div>
  );
}