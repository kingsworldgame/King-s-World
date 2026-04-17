import {
  formatDecimal,
  formatInteger,
  formatPercent,
  imperialAnalytics,
} from "@/lib/imperial-analytics";

type PieItem = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type ScorePoint = {
  day: number;
  avgScoreAlive: number;
};

const PIE_SIZE = 232;
const PIE_STROKE = 34;
const LINE_WIDTH = 720;
const LINE_HEIGHT = 260;
const LINE_PADDING = 24;

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInRadians: number) {
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(" ");
}

function buildPieSegments(items: PieItem[]) {
  const total = items.reduce((acc, item) => acc + item.value, 0);
  const radius = PIE_SIZE / 2 - PIE_STROKE;
  let angleCursor = -Math.PI / 2;

  return items.map((item) => {
    const slice = total === 0 ? 0 : (item.value / total) * Math.PI * 2;
    const startAngle = angleCursor;
    const endAngle = angleCursor + slice;
    angleCursor = endAngle;

    return {
      ...item,
      percent: total === 0 ? 0 : (item.value / total) * 100,
      path: describeArc(PIE_SIZE / 2, PIE_SIZE / 2, radius, startAngle, endAngle),
    };
  });
}

function buildLineChart(points: ScorePoint[]) {
  const usableWidth = LINE_WIDTH - LINE_PADDING * 2;
  const usableHeight = LINE_HEIGHT - LINE_PADDING * 2;
  const values = points.map((point) => point.avgScoreAlive);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);

  const normalized = points.map((point, index) => {
    const x = LINE_PADDING + (usableWidth / Math.max(1, points.length - 1)) * index;
    const y = LINE_HEIGHT - LINE_PADDING - ((point.avgScoreAlive - minValue) / range) * usableHeight;
    return { x, y, day: point.day, value: point.avgScoreAlive };
  });

  const linePath = normalized
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const firstPoint = normalized[0];
  const lastPoint = normalized[normalized.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${(LINE_HEIGHT - LINE_PADDING).toFixed(2)} L ${firstPoint.x.toFixed(2)} ${(LINE_HEIGHT - LINE_PADDING).toFixed(2)} Z`;

  const gridValues = [minValue, minValue + range / 2, maxValue];

  return {
    areaPath,
    linePath,
    points: normalized,
    gridLines: gridValues.map((value) => ({
      label: formatInteger(value),
      y: LINE_HEIGHT - LINE_PADDING - ((value - minValue) / range) * usableHeight,
    })),
  };
}

export function ChroniclesPanel() {
  const { overview, kingDeathBreakdown, scoreEvolution, seedTable, scenarioHighlights, legacyLeaders } = imperialAnalytics;
  const pieSegments = buildPieSegments(kingDeathBreakdown);
  const lineChart = buildLineChart(scoreEvolution);

  return (
    <section className="chronicles-panel">
      <div className="chronicles-header">
        <div>
          <p className="chronicles-kicker">Imperial Chronicles</p>
          <h2>Stress test do mundo de 120 dias</h2>
          <p className="chronicles-copy">
            Painel consolidado com 5 seeds baseline, mais dois archetypes extremos para medir colapso,
            sobrevivencia e teto de score do KingsWorld.
          </p>
        </div>

        <div className="chronicles-header__meta">
          <div>
            <span>Pool baseline</span>
            <strong>5 seeds</strong>
          </div>
          <div>
            <span>Populacao</span>
            <strong>8 humanos + 42 bots</strong>
          </div>
          <div>
            <span>Duracao</span>
            <strong>120 dias</strong>
          </div>
        </div>
      </div>

      <div className="chronicles-grid chronicles-grid--top">
        <article className="chronicles-card chronicles-card--survival">
          <span className="chronicles-label">Taxa de sobrevivencia global</span>
          <strong className="chronicles-number">{formatPercent(overview.survivalRateGlobal, 1)}</strong>
          <p className="chronicles-copy chronicles-copy--tight">
            Media de {formatDecimal(overview.averageAliveAtEnd, 1)} vivos ao fim de 50 vagas, com
            {" "}{formatDecimal(overview.averageHumansAlive, 1)} humanos preservados.
          </p>
          <div className="chronicles-stat-strip">
            <div>
              <span>Humanos vivos</span>
              <strong>{formatPercent(overview.humanSurvivalRate, 1)}</strong>
            </div>
            <div>
              <span>Aldeias no dia 120</span>
              <strong>{formatDecimal(overview.averageVillagesDay120, 1)}</strong>
            </div>
            <div>
              <span>Top 1 medio</span>
              <strong>{formatDecimal(overview.averageTop1Power, 1)}</strong>
            </div>
          </div>
        </article>

        <article className="chronicles-card chronicles-card--pie">
          <div className="chronicles-card__head">
            <div>
              <span className="chronicles-label">Causa mortis do Rei</span>
              <h3>Peso de PvP versus Horda</h3>
            </div>
          </div>

          <div className="chronicles-pie-layout">
            <svg viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`} className="chronicles-pie" aria-label="Distribuicao das mortes do Rei">
              <circle
                cx={PIE_SIZE / 2}
                cy={PIE_SIZE / 2}
                r={PIE_SIZE / 2 - PIE_STROKE}
                fill="none"
                stroke="rgba(130, 160, 194, 0.14)"
                strokeWidth={PIE_STROKE}
              />
              {pieSegments.map((segment) => (
                <path
                  key={segment.key}
                  d={segment.path}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={PIE_STROKE}
                  strokeLinecap="round"
                />
              ))}
              <text x="50%" y="48%" textAnchor="middle" className="chronicles-pie__value">
                {formatInteger(kingDeathBreakdown.reduce((acc, item) => acc + item.value, 0))}
              </text>
              <text x="50%" y="58%" textAnchor="middle" className="chronicles-pie__label">
                mortes de Rei
              </text>
            </svg>

            <div className="chronicles-legend">
              {pieSegments.map((segment) => (
                <div key={segment.key} className="chronicles-legend__item">
                  <span className="chronicles-legend__swatch" style={{ backgroundColor: segment.color }} />
                  <div>
                    <strong>{segment.label}</strong>
                    <p>
                      {formatInteger(segment.value)} casos ({formatPercent(segment.percent, 1)})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="chronicles-card chronicles-card--chart">
          <div className="chronicles-card__head">
            <div>
              <span className="chronicles-label">Evolucao do score medio</span>
              <h3>Crescimento baseline das 5 seeds</h3>
            </div>
            <div className="chronicles-inline-metrics">
              <span>Dia 1: {formatInteger(scoreEvolution[0]?.avgScoreAlive ?? 0)}</span>
              <span>Dia 120: {formatInteger(scoreEvolution[scoreEvolution.length - 1]?.avgScoreAlive ?? 0)}</span>
            </div>
          </div>

          <svg viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`} className="chronicles-line" aria-label="Linha de evolucao do score medio">
            <defs>
              <linearGradient id="chroniclesArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(95, 144, 198, 0.42)" />
                <stop offset="100%" stopColor="rgba(95, 144, 198, 0.04)" />
              </linearGradient>
            </defs>

            {lineChart.gridLines.map((gridLine) => (
              <g key={gridLine.label}>
                <line
                  x1={LINE_PADDING}
                  y1={gridLine.y}
                  x2={LINE_WIDTH - LINE_PADDING}
                  y2={gridLine.y}
                  className="chronicles-line__grid"
                />
                <text x={LINE_PADDING} y={gridLine.y - 6} className="chronicles-line__axis">
                  {gridLine.label}
                </text>
              </g>
            ))}

            <path d={lineChart.areaPath} fill="url(#chroniclesArea)" />
            <path d={lineChart.linePath} fill="none" stroke="#5f90c6" strokeWidth="4" strokeLinecap="round" />
            {lineChart.points.filter((point) => point.day % 20 === 0 || point.day === 1 || point.day === 120).map((point) => (
              <g key={point.day}>
                <circle cx={point.x} cy={point.y} r="4.5" fill="#5f90c6" />
                <text x={point.x} y={LINE_HEIGHT - 4} textAnchor="middle" className="chronicles-line__axis">
                  D{point.day}
                </text>
              </g>
            ))}
          </svg>
        </article>
      </div>

      <div className="chronicles-grid chronicles-grid--bottom">
        <article className="chronicles-card chronicles-card--table">
          <div className="chronicles-card__head">
            <div>
              <span className="chronicles-label">Comparativo multi-seed</span>
              <h3>Media e variancia do baseline</h3>
            </div>
          </div>

          <div className="chronicles-table-wrap">
            <table className="chronicles-table">
              <thead>
                <tr>
                  <th>Seed</th>
                  <th>Rei PvP</th>
                  <th>Rei PvE</th>
                  <th>Aldeias D120</th>
                  <th>Top 1</th>
                  <th>Humanos</th>
                </tr>
              </thead>
              <tbody>
                {seedTable.map((row) => (
                  <tr key={row.seed}>
                    <td>{row.seed}</td>
                    <td>{row.kingDeathsPvp}</td>
                    <td>{row.kingDeathsPve}</td>
                    <td>{row.totalVillagesDay120}</td>
                    <td>{formatInteger(row.top1PowerScore)}</td>
                    <td>{row.humansAlive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="chronicles-card chronicles-card--scenarios">
          <div className="chronicles-card__head">
            <div>
              <span className="chronicles-label">Scenario diagnostics</span>
              <h3>Brutal versus conservative</h3>
            </div>
          </div>

          <div className="chronicles-scenarios">
            {scenarioHighlights.map((scenario) => (
              <div key={scenario.key} className="chronicles-scenario">
                <span className="chronicles-scenario__tag">{scenario.title}</span>
                <strong>{scenario.headline}</strong>
                <p>{scenario.detail}</p>
                <div className="chronicles-scenario__metrics">
                  {scenario.metrics.map((metric) => (
                    <span key={metric}>{metric}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="chronicles-card chronicles-card--legacy">
          <div className="chronicles-card__head">
            <div>
              <span className="chronicles-label">Lista de legado</span>
              <h3>Quem venceria o mundo</h3>
            </div>
          </div>

          <div className="chronicles-legacy">
            {legacyLeaders.map((leader) => (
              <div key={`${leader.label}-${leader.seed}`} className="chronicles-legacy__item">
                <span className="chronicles-legacy__rank">#{leader.rank}</span>
                <div>
                  <strong>{leader.name}</strong>
                  <p>
                    {leader.label} - {leader.scenario} - Seed {leader.seed}
                  </p>
                </div>
                <div className="chronicles-legacy__score">
                  <span>{leader.type}</span>
                  <strong>{formatInteger(leader.score)}</strong>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
