importScripts('solver.js');


onmessage = (e) => {
    const result = solve(e.data.grid, e.data.args);

    postMessage({ type: 'result', result });
  };