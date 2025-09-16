// Mock for D3.js library
const d3Mock = {
  select: jest.fn().mockReturnThis(),
  selectAll: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  data: jest.fn().mockReturnThis(),
  enter: jest.fn().mockReturnThis(),
  exit: jest.fn().mockReturnThis(),
  merge: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  transition: jest.fn().mockReturnThis(),
  duration: jest.fn().mockReturnThis(),
  ease: jest.fn().mockReturnThis(),
  call: jest.fn().mockReturnThis(),
  each: jest.fn().mockReturnThis(),
  node: jest.fn().mockReturnThis(),
  nodes: jest.fn().mockReturnValue([]),
  size: jest.fn().mockReturnValue(0),
  empty: jest.fn().mockReturnValue(true),
  filter: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  raise: jest.fn().mockReturnThis(),
  lower: jest.fn().mockReturnThis(),
  drag: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subject: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis()
  }),
  zoom: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    scaleExtent: jest.fn().mockReturnThis(),
    translateExtent: jest.fn().mockReturnThis(),
    extent: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis()
  }),
  zoomIdentity: {
    k: 1,
    x: 0,
    y: 0
  },
  event: {
    transform: {
      k: 1,
      x: 0,
      y: 0
    }
  },
  forceSimulation: jest.fn().mockReturnValue({
    force: jest.fn().mockReturnThis(),
    nodes: jest.fn().mockReturnThis(),
    alpha: jest.fn().mockReturnThis(),
    restart: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    alphaTarget: jest.fn().mockReturnThis(),
    alphaDecay: jest.fn().mockReturnThis(),
    velocityDecay: jest.fn().mockReturnThis()
  }),
  forceLink: jest.fn().mockReturnValue({
    id: jest.fn().mockReturnThis(),
    distance: jest.fn().mockReturnThis(),
    strength: jest.fn().mockReturnThis()
  }),
  forceManyBody: jest.fn().mockReturnValue({
    strength: jest.fn().mockReturnThis(),
    distanceMin: jest.fn().mockReturnThis(),
    distanceMax: jest.fn().mockReturnThis()
  }),
  forceCenter: jest.fn().mockReturnValue({
    x: jest.fn().mockReturnThis(),
    y: jest.fn().mockReturnThis()
  }),
  hierarchy: jest.fn().mockReturnValue({
    sum: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis()
  }),
  tree: jest.fn().mockReturnValue({
    size: jest.fn().mockReturnThis(),
    nodeSize: jest.fn().mockReturnThis(),
    separation: jest.fn().mockReturnThis()
  }),
  pack: jest.fn().mockReturnValue({
    size: jest.fn().mockReturnThis(),
    radius: jest.fn().mockReturnThis(),
    padding: jest.fn().mockReturnThis()
  }),
  cluster: jest.fn().mockReturnValue({
    size: jest.fn().mockReturnThis(),
    nodeSize: jest.fn().mockReturnThis(),
    separation: jest.fn().mockReturnThis()
  }),
  partition: jest.fn().mockReturnValue({
    size: jest.fn().mockReturnThis(),
    round: jest.fn().mockReturnThis(),
    padding: jest.fn().mockReturnThis()
  }),
  treemap: jest.fn().mockReturnValue({
    size: jest.fn().mockReturnThis(),
    tile: jest.fn().mockReturnThis(),
    round: jest.fn().mockReturnThis(),
    padding: jest.fn().mockReturnThis()
  }),
  scaleOrdinal: jest.fn().mockReturnValue({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis()
  }),
  schemeCategory10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
};

// Mock all D3 submodules
const d3Submodules = [
  'd3-array',
  'd3-axis',
  'd3-brush',
  'd3-chord',
  'd3-color',
  'd3-contour',
  'd3-delaunay',
  'd3-dispatch',
  'd3-drag',
  'd3-dsv',
  'd3-ease',
  'd3-fetch',
  'd3-force',
  'd3-format',
  'd3-geo',
  'd3-hierarchy',
  'd3-interpolate',
  'd3-path',
  'd3-polygon',
  'd3-quadtree',
  'd3-random',
  'd3-scale-chromatic',
  'd3-selection',
  'd3-shape',
  'd3-time',
  'd3-time-format',
  'd3-timer',
  'd3-transition',
  'd3-zoom'
];

// Create mocks for all submodules
d3Submodules.forEach(submodule => {
  jest.mock(submodule, () => d3Mock);
});

module.exports = d3Mock;