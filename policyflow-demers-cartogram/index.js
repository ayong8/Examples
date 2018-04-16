var width = 960
var height = 600

var interval = 2000
var maxSize = 140

var years = d3.range(1900, 2010 + 1, 10)
var yearIndex = -1
var year = years[0]

var projection = d3.geoAlbersUsa()
    .scale(width)
    .translate([width / 2, height / 2])

var size = d3.scaleSqrt().range([0, maxSize])

var svg = d3.select('body').append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')

var yearLabel = svg.append('text')
    .attr('class', 'year')
    .attr('x', width / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')

var linkForce = d3.forceLink()
    .id(function (d) { return d.state })
    .distance(function (d) {
        return (
            size(d.source.population.find(function (e) { return e.year === year }).pop) +
            size(d.target.population.find(function (e) { return e.year === year }).pop)
        ) / 2
    })
    .strength(0.6)

var collisionForce = rectCollide()
    .size(function (d) {
        var l = size(d.population.find(function (e) { return e.year === year }).pop)
        return [l, l]
    })
    .iterations(12)

var simulation = d3.forceSimulation()
    .force('center', d3.forceCenter(width / 2, (height - maxSize) / 2))
    .force('link', linkForce)
    .force('collision', collisionForce)
    .force('x', d3.forceX(function (d) { return d.xi }).strength(0.0125))
    .force('y', d3.forceY(function (d) { return d.yi }).strength(0.0125))

d3.json('data.json', initialize)

function initialize(error, data) {
    if (error) { throw error }

    var nodes = data.nodes
    var links = data.links

    size.domain([0, d3.max(nodes, function (d) {
        return d3.max(d.population, function (e) { return e.pop })
    })])

    nodes.forEach(function (d) {
        var coords = projection([d.lon, d.lat])
        d.x = d.xi = coords[0]
        d.y = d.yi = coords[1]
    })

    var states = svg.selectAll('.state')
        .data(nodes)
        .enter().append('g')
        .attr('class', 'state')

    states.append('rect')
    states.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.3em')
        .text(function (d) { return d.state })

    simulation.nodes(nodes)
    simulation.force('link').links(links)
    simulation.on('tick', ticked)

    update()
    d3.interval(update, interval)

    function update() {
        year = years[++yearIndex >= years.length ? yearIndex = 0 : yearIndex]

        yearLabel.text(year)

        if (yearIndex === 0) { 
            nodes.forEach(function (d) { 
                d.x = d.xi; 
                d.y = d.yi; 
            }) 
        }

        simulation.nodes(nodes).alpha(1).restart()
    }

    function ticked() {
        var sizes = d3.local()

        states
            .property(sizes, function (d) {
                return size(d.population.find(function (e) { return e.year === year }).pop)
            })
            .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')' })

        states.selectAll('rect')
            .attr('x', function (d) { return sizes.get(this) / -2 })
            .attr('y', function (d) { return sizes.get(this) / -2 })
            .attr('width', function (d) { return sizes.get(this) })
            .attr('height', function (d) { return sizes.get(this) })
    }
}

function rectCollide() {
    var nodes, sizes, masses
    var size = constant([0, 0])
    var strength = 1
    var iterations = 1

    function force() {
        var node, size, mass, xi, yi
        var i = -1
        while (++i < iterations) { iterate() }

        function iterate() {
            var j = -1
            var tree = d3.quadtree(nodes, xCenter, yCenter).visitAfter(prepare)

            while (++j < nodes.length) {
                node = nodes[j]
                size = sizes[j]
                mass = masses[j]
                xi = xCenter(node)
                yi = yCenter(node)

                tree.visit(apply)
            }
        }

        function apply(quad, x0, y0, x1, y1) {
            var data = quad.data
            var xSize = (size[0] + quad.size[0]) / 2
            var ySize = (size[1] + quad.size[1]) / 2
            if (data) {
                if (data.index <= node.index) { return }

                var x = xi - xCenter(data)
                var y = yi - yCenter(data)
                var xd = Math.abs(x) - xSize
                var yd = Math.abs(y) - ySize

                if (xd < 0 && yd < 0) {
                    var l = Math.sqrt(x * x + y * y)
                    var m = masses[data.index] / (mass + masses[data.index])

                    if (Math.abs(xd) < Math.abs(yd)) {
                        node.vx -= (x *= xd / l * strength) * m
                        data.vx += x * (1 - m)
                    } else {
                        node.vy -= (y *= yd / l * strength) * m
                        data.vy += y * (1 - m)
                    }
                }
            }

            return x0 > xi + xSize || y0 > yi + ySize ||
                   x1 < xi - xSize || y1 < yi - ySize
        }

        function prepare(quad) {
            if (quad.data) {
                quad.size = sizes[quad.data.index]
            } else {
                quad.size = [0, 0]
                var i = -1
                while (++i < 4) {
                    if (quad[i] && quad[i].size) {
                        quad.size[0] = Math.max(quad.size[0], quad[i].size[0])
                        quad.size[1] = Math.max(quad.size[1], quad[i].size[1])
                    }
                }
            }
        }
    }

    function xCenter(d) { return d.x + d.vx }
    function yCenter(d) { return d.y + d.vy }

    force.initialize = function (_) {
        sizes = (nodes = _).map(size)
        masses = sizes.map(function (d) { return d[0] * d[1] })
    }

    force.size = function (_) {
        return (arguments.length
             ? (size = typeof _ === 'function' ? _ : constant(_), force)
             : size)
    }

    force.strength = function (_) {
        return (arguments.length ? (strength = +_, force) : strength)
    }

    force.iterations = function (_) {
        return (arguments.length ? (iterations = +_, force) : iterations)
    }

    return force
}

function constant(_) {
    return function () { return _ }
}