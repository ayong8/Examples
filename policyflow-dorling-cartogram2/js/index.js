// Ratio of Obese (BMI >= 30) in U.S. Adults, CDC 2008
var valueById = [
   NaN, .187, .198,  NaN, .133, .175, .151,  NaN, .100, .125,
  .171,  NaN, .172, .133,  NaN, .108, .142, .167, .201, .175,
  .159, .169, .177, .141, .163, .117, .182, .153, .195, .189,
  .134, .163, .133, .151, .145, .130, .139, .169, .164, .175,
  .135, .152, .169,  NaN, .132, .167, .139, .184, .159, .140,
  .146, .157,  NaN, .139, .183, .160, .143
];

var dataset;

var margin = {top: 0, right: 0, bottom: 0, left: 0},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom,
    padding = 10;

var projection = d3.geo.albersUsa();

var radius = d3.scale.sqrt()
    .domain([0, d3.max(valueById)])
    .range([0, 30]);

var force = d3.layout.force()
    .charge(0)
    .gravity(0)
    .size([width, height]);

var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.json("./data/us-state-centroids.json", function(error, states) {
	if (error) throw error;
	
	d3.csv("./data/policy_adoptions.csv")
        .row(function(d) {
            return {
                policy: d.policy_id,
                lat: parseFloat(d.lat),
                lng: parseFloat(d.long),
                state: d.state,
                state_name: d.state_name,
                value: d.adoption_case,
                adopted_year: new Date(d.adopted_year)
            };
        })
        .get(function(err, rows) {
            if (err) return console.error(err);
            dataset = rows;
        });

	var nodes, node; 
	var gStates; 

	var update = function(dataset){
		nodes = states.features
			.map(function(d, i) {
				var point = projection(d.geometry.coordinates),
					value = 3;
				if (isNaN(value)) fail();
					return {
						x: point[0], y: point[1],
						x0: point[0], y0: point[1],
						r: Math.random() * 50,
						id: i,
						value: value
					};
			});

		gStates = svg.selectAll(".g_state")
			.data(nodes);

		gStates.enter().append("g")
			.attr("class", function(d){
				return "g_state g_state_" + d.r;
			})
			.append("circle")
			.attr("r", function(d) { return d.r; })

		gStates.selectAll("circle")
			.transition().duration(200)
			.attr("r", function(d) { 
					console.log(d.r);
					return d.r; 
			});
			
		console.log("pause");
		gStates.exit().remove();

		force
			.nodes(nodes)
			.on("tick", tick)
			.alpha(1)
			.start();
	}

	function tick(e) {
		gStates.each(gravity(e.alpha * .1))
			.each(collide(.5))
			.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
	}

	function gravity(k) {
		return function(d) {
			d.x += (d.x0 - d.x) * k;
			d.y += (d.y0 - d.y) * k;
		};
	}

	function collide(k) {
		var q = d3.geom.quadtree(nodes);
		
		return function(node) {
			var gNode = svg.selectAll(".g_state")
					.filter(function(d){
						return d.id === node.id;
					})
			var nodeSize = gNode.node().getBBox().height;
			var nr = nodeSize/1.5 + padding,
				nx1 = node.x - nr,
				nx2 = node.x + nr,
				ny1 = node.y - nr,
				ny2 = node.y + nr;
			q.visit(function(quad, x1, y1, x2, y2) {
			if (quad.point && (quad.point !== node)) {
				var x = node.x - quad.point.x,
					y = node.y - quad.point.y,
					l = x * x + y * y,
					r = nr + quad.point.r;
				if (l < r * r) {
				l = ((l = Math.sqrt(l)) - r) / l * k;
				node.x -= x *= l;
				node.y -= y *= l;
				quad.point.x += x;
				quad.point.y += y;
				}
			}
			return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
			});
		};
	}

  //*** For slider ***/
  var minDateUnix = new Date('1800-01-01').getFullYear();
  var maxDateUnix = new Date('2017-12-31').getFullYear();
  var step = 60*60*24;

  d3.select('#slider3').call(d3.slider()
      .axis(true).min(minDateUnix).max(maxDateUnix)
      .on("slide", function(evt, value) {
			var newValue = value;
			d3.select("#current_year").transition()
				.tween("text", function(d) {
					var self = this;
					var i = d3.interpolateRound(Math.floor(d3.select(this).text()), Math.floor(newValue));
					return function(t) {
						d3.select(this).text(i(t));
					};
				});
			var newData = _(dataset).filter( function(site) {
				var adopted_year = site.adopted_year.getYear() + 1900;
				return adopted_year < value;
			})
      
        	update(newData);
      })
  );
});

