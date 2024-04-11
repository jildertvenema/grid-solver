function solve(initialGrid, args={}) {
    const MIN_GROUP_SIZE = args.MIN_GROUP_SIZE || 2;
    const MAX_NODES = args.MAX_NODES || 450;
    const MIN_SEARCH_SECONDS = args.MIN_SEARCH_SECONDS || .1;
    const compareOldWay = args.compareOldWay;

    let exploredNodes = 0;
    const logInterval = 500;
    let currentLogInterval = 0;
    let prevTime = Date.now();
    const start = Date.now();

    initialGrid = initialGrid.trim()
        .split('\n')
        .map(str => str.trim().split(''));

    function cloneGrid(grid) {
        return [...grid.map(row => [...row])];
    }

    function getElapsedSeconds(){
        const end = Date.now();
        const elapsed = end - start;
        return elapsed / 1000;
    }

    function getGroups(grid) {
        const groups = []
        const groupedPositions = new Set()
        let groupedItems = 0;
        let emptyCells = 0;
        let notGroupedCells = 0;
        for (let _x = 0; _x < grid.length; _x++) {
            for (let _y = 0; _y < grid[_x].length; _y++) {
                const col = grid[_x][_y];
                if (col === '-') emptyCells++;
                if (col !== '-' && !groupedPositions.has(_x + '_' + _y)) {

                    let currentGroup = [{ x: _x, y: _y, c: col }]
                    let neighborsToCheck = [{ x: _x, y: _y, c: col }]
                    let newneighborsToCheck = []
                    let foundNew = true;
                    while (foundNew) {
                        let newneighbors = [];
                        foundNew = false;
                        newneighborsToCheck = []
                        for(let i = 0; i < neighborsToCheck.length; i++) {
                            const neighbor = neighborsToCheck[i];
                            const {x, y} = neighbor;
                            if (get(grid, x + 1, y)) newneighbors.push({ x: x + 1, y: y });
                            if (get(grid, x - 1, y)) newneighbors.push({ x: x - 1, y: y });
                            if (get(grid, x, y + 1)) newneighbors.push({ x: x, y: y + 1 });
                            if (get(grid, x, y - 1)) newneighbors.push({ x: x, y: y - 1 });

                            newneighbors = newneighbors
                                .filter((n) => grid[n.x][n.y] === col)
                                .filter((nm) => !currentGroup.find(n => n.x === nm.x && n.y === nm.y))
                                .map(((nm) => ({ x: nm.x, y: nm.y, c: grid[nm.x][nm.y] })));

                            if (newneighbors.length > 0) {
                                foundNew = true;
                            }

                            currentGroup.push(...newneighbors)
                            newneighborsToCheck.push(...newneighbors)
                        }
                        neighborsToCheck = newneighborsToCheck
                    }

                    if (currentGroup.length >= MIN_GROUP_SIZE) {
                        groups.push(currentGroup);
                        currentGroup.forEach(n => groupedPositions.add(n.x + '_' + n.y))
                        groupedItems += currentGroup.length;
                    }
                    else {
                        notGroupedCells += currentGroup.length;
                    }
                }
            }
        }

        groups.groupedItems = groupedItems;
        groups.emptyCells = emptyCells;
        groups.notGroupedCells = notGroupedCells;
        return groups;
    }

    function noItemsLeft(grid) {
        for (let x = 0; x < grid.length; x++) {
            for (let y = 0; y < grid[x].length; y++) {
                if (grid[x][y] !== '-') return false;
            }
        }

        return true;
    }

    const gridScoreMap = {}
    let bestScore = null;

    function getFinalScore(grid, score) {
        const hasNoItems = noItemsLeft(grid);
        if (hasNoItems) return score + 1000;
        
        return score;
    }

    function getPotentialScore(grid, score, groups) {

        if (compareOldWay) return getFinalScore(grid, score);


        return 100 - groups.notGroupedCells;

        // const hasNoItems = noItemsLeft(grid);
        // const potentialScore = groups.groupedItems + groups.emptyCells //+ score / 2000;
        // if (hasNoItems) return 10000 + potentialScore;
        
        // if (groups.length === 0) return -10000;

        // return potentialScore;
    }


    function exploreNodes(nodes, depth) {

        if (bestScore && bestScore.noItemsLeft && getElapsedSeconds() > MIN_SEARCH_SECONDS) {
            return true;
        }
        
        let nextNodes = [];
        nodes.forEach(({ grid, score, moves, scores, groups }) => {
            groups = groups ?? getGroups(grid);

            // no more move possible
            if (groups.length === 0) {
                const finalScore = getFinalScore(grid, score);
                if (bestScore == null || bestScore.score < finalScore) {
                    bestScore = { grid, score: finalScore, moves, scores, noItemsLeft: noItemsLeft(grid)}
                }
                if (noItemsLeft(grid) && getElapsedSeconds() > MIN_SEARCH_SECONDS) {
                    return true;
                }
            }

            groups.forEach((nextMove, i, self) => {
                const nextScore = score + nextMove.length * (nextMove.length - 1);
                const nextGrid = cloneGrid(grid);
                clearGroup(nextGrid, nextMove);
                gravity(nextGrid);
                let stringGrid = JSON.stringify(nextGrid);

                if (!gridScoreMap[stringGrid] || gridScoreMap[stringGrid] < nextScore) {

                    if (gridScoreMap[stringGrid]) {
                        nextNodes = nextNodes.filter(n => n.stringGrid !== stringGrid || n.score > nextScore);
                    }

                    gridScoreMap[stringGrid] = nextScore;
                    nextNodes.push({
                        grid: nextGrid, score: nextScore, moves: [...moves, nextMove], scores: [...scores, nextMove.length * (nextMove.length - 1)], stringGrid, groups: getGroups(nextGrid)
                    })
                }
            })
        })

        exploredNodes += nodes.length;
        const now = Date.now();
        currentLogInterval += now - prevTime;
        prevTime = now;
        if (currentLogInterval >= logInterval) {
            postMessage({ bestScore, exploredNodes, time: getElapsedSeconds(), type: 'progress' });
            currentLogInterval = 0;
        }

        if (nextNodes.length > 0) {
            let removedNodes = []
            if (nextNodes.length > MAX_NODES) {
                nextNodes = nextNodes.sort((a, b) => getPotentialScore(b.grid, b.score, b.groups) - getPotentialScore(a.grid, a.score, b.groups))
                removedNodes = nextNodes.slice(MAX_NODES)
                nextNodes = nextNodes.slice(0, MAX_NODES)
            }
            const finised = exploreNodes(nextNodes, depth + 1);
            while (!finised && removedNodes.length > 0)  {

                nextNodes = removedNodes.slice(0, MAX_NODES)
                removedNodes = removedNodes.slice(MAX_NODES)

                exploreNodes(nextNodes, depth + 1);
            }
        }
    }


    exploreNodes([{ grid: cloneGrid(initialGrid), score: 0, moves: [], scores: [] }], 0);

    return bestScore;
}

const solveWithPromise = (grid) => {
    return new Promise(resolve => {
        const result = solve(grid)
        resolve(result);
    })
}


function clearGroup(grid, group) {
    group.forEach(({ x, y }) => {
        grid[x][y] = '-';
    })
}

function gravity(grid, animate=false) {
    let somethingMoving = false;

    do {
        somethingMoving = false;
        for (let x = grid.length - 1; x >= 0; x--)
            for (let y = 0; y < grid[x].length; y++) {
                if (get(grid, x, y) !== '-' && get(grid, x + 1, y) === '-') {
                    grid[x + 1][y] = grid[x][y];
                    grid[x][y] = '-';
                    somethingMoving = true;
                }
            }
    }
    while (somethingMoving)

    rightShift(grid, animate);
}

function rightShift(grid, animate=false) {
    let somethingMoving = false;
    do {
        somethingMoving = false;
        for (let y = 0; y < grid[0].length - 1; y++) {
            if (allRightColumnsEmpty(grid, y)) {

                for (let x = 0; x < grid.length; x++) {
                    grid[x][y + 1] = grid[x][y];
                    grid[x][y] = '-'
                }

                somethingMoving = true;
            }
        }
        if (animate) printGrid(grid, []);
    }
    while (somethingMoving);
}


function get(grid, x, y) {
    if (!grid[x]) return undefined
    return grid[x] && grid[x][y];
}

function allRightColumnsEmpty(grid, y) {
    const currentYValues = [];
    for (let x = 0; x < grid.length; x++) {
        currentYValues.push(grid[x][y]);
        if (grid[x][y + 1] !== '-') {
            return false;
        }
    }

    if (currentYValues.length === currentYValues.filter(v => v === '-').length) {
        return false;
    }

    return true;
}

function printGrid(grid, moves=[]) {
    console.log('\n\n\n\n\n\n\n\n\n');
    let print = ''
    grid.forEach((row, x) => {
        print += row.map((c, y) => moves.find(m => m.x === x && m.y === y) ? ('\\033[33m' + c) : '\\033[31m' +c).join(' ') + '\n'
    })

    console.log(print);
    console.log('');
}
