var data = {
    "name": "Root",
    "id": 0,
    "children": [
        {
            "name": "Leaf",
            "size": 2098629,
            "id": 1,
        },
        {
            "name": "Leaf",
            "size": 104720,
            "id": 2
        },
        {
            "name": "Leaf",
            "size": 5430,
            "id": 3,
        },
        {
            "name": "Leaf",
            "size": 102096,
            "id" : 4
        },
        {
            "name": "Leaf",
            "size": 986974,
            "id": 5
        },
        {
            "name": "Leaf",
            "size": 59735,
            "id": 6
        },
        {
            "name": "Leaf",
            "size": 1902,
            "id": 7
        },
    ]
};

var diameter = 500,
    format = d3.format(",d"),
    diffsize = true,
    circleMin = 100,
    circleMax = 5000000;

var svg = d3.select("#vis").append("svg")
    .attr("width", diameter)
    .attr("height", diameter);

var pack = d3.layout.pack()
    .size([diameter - 4, diameter - 4])
    .sort( function(a, b) {
        return -(a.value - b.value);
    })
    .value(function(d) {
        if (diffsize) {
            return d.size;
        } else {
            return 1000;
        }
    });

var vis, titles, circles;

// Munch some data into the children array
function updateData() {
   data.children.push({
      "name": "Leaf",
      "synthetic": true,
      "size": Math.floor(Math.random() * circleMax) + circleMin,
      "id": Math.floor(Math.random() * 1000)
   });
   return data;
};

// Visualization render
function render(data) {
    var packedNodes = pack.nodes(data);

    visSelection = svg.selectAll("g.node")
        .data(packedNodes.splice(1, packedNodes.length), function(d) {
            return d.id;
        });

    vis = visSelection.enter()
        .append("g")
        .classed("node", true);

    visSelection.selectAll("circle")
        .style("fill", function(d) { return !d.children ? "white" : "beige"; })

    // add a circle to the wrapping group element
    circles = vis.append("circle")
        .attr("fill", "yellow")
        .attr("stroke", "black")
        .attr("r", 0);

    visSelection.selectAll("circle")
        .transition().duration(500)
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; })
        .attr("r", function(d) { return d.r; });
}

// wire up button
d3.select("#adddata").on("click", function() {
    data = updateData();
    render(data);
});

d3.select("#samesize").on("click", function() {
    diffsize = false;
    render(data);
});

d3.select("#diffsize").on("click", function() {
    diffsize = true;
    render(data);
});

d3.select("#circlemin").on("change", function() {
    circleMin = parseInt(this.value, 10);
})

d3.select("#circlemax").on("change", function() {
    circleMax = parseInt(this.value, 10);
})

render(data);