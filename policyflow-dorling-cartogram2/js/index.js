var layout = {
	margin: {
		top: 0, 
		right: 0, 
		bottom: 0, 
		left: 0
	},
    width: 960,
    height: 500,
	padding: 2,
    zoomMargin: 30
}

var view = [ 
	layout.width/2, 
	layout.height/2, 
	layout.height/2
];

var projection = d3.geo.albersUsa();

var force = d3.layout.force()
    .charge(0)
    .gravity(0)
    .size([layout.width, layout.height]);

var svg = d3.select("body").append("svg")
    .attr("width", layout.width + layout.margin.left + layout.margin.right)
    .attr("height", layout.height + layout.margin.top + layout.margin.bottom)
  	.append("g")
	.attr("transform", "translate(" + layout.margin.left + "," + layout.margin.top + ")");

var tip = d4.tip()
    .attr("class", "d3-tip")
    .offset([-10, 0])
    .html(function(d) {
      //return xCat + ": " + d[xCat] + "<br>" + yCat + ": " + d[yCat];
      return d.parent? ("Policy_id" + ": " + d.data.policy)
                : ("State: " + d.data.name);
    });

var scale = {
	adoptionScoreScale: d4.scaleQuantile(),
	policyCircleScale: d4.scaleLinear(),   // changes over time
	policyColorScale: d4.scaleLinear()     // constant over time
    			.range(["yellow","#f00"])
    			.domain([0, 5]),
	stateCircleScale: d4.scaleLinear()
				.range([10, 40]),
	stateCircleGlobalScale: d4.scaleLinear()
				.range([1, 3])
				.domain([0, 500]),
	stateColorScale: d4.scaleLinear()  // state circle color depends on state's influence score
            	.range(["#fffea4","#df0000"])
            	.domain(d4.extent(Object.values(Object.values(static.centrality)[0]).map(function(d){ return d.pageRank; }))),
	stateInfStrokeScale: d4.scaleLinear()
    			.range([1, 4])
    			.domain(d4.extent(Object.values(Object.values(static.centrality)[0]).map(function(d){ return d.pageRank; }))),
	stateInfRadiusScale: d4.scaleLinear()
    			.range([1, 1.5])
    			.domain(d4.extent(Object.values(Object.values(static.centrality)[0]).map(function(d){ return d.pageRank; }))),
	stateManyAdoptionPolicyRadiusScale: d4.scaleLinear(),
	stateInnerColorScale: d4.scaleLinear()
				.range(["lemonchiffon", "gold"])
				.domain([0, 500]),
	stateInfScale: ""
}
var threshold = {
	policyCircle: { 
		max: 5,
		min: 3,
		ratio: 2
	},
	numPolicyCircles: 20,
	stateManyAdoptionScoreScale: {
		range: {
			min: 1,
			max: 3
		}
	},
	setPolicyCircle: function(yearUntil){
		if (yearUntil <= 1850) {
			this.policyCircle.max = 5;
			this.policyCircle.min = this.policyCircle.max / this.policyCircle.ratio;
		} else {
			this.policyCircle.max = 2.5;
			this.policyCircle.min = this.policyCircle.max / this.policyCircle.ratio;
		}
	},
	setStateManyAdoptionScoreScale: function(yearUntil){
		if (yearUntil <= 1920) {
			console.log("here1");
			if (yearUntil === 1916){
				console.log("here");
				this.stateManyAdoptionScoreScale.range.min = 1;
				this.stateManyAdoptionScoreScale.range.max = 1;
			} else {
				this.stateManyAdoptionScoreScale.range.min = 1;
				this.stateManyAdoptionScoreScale.range.max = 3;
			}
		} else {
			this.stateManyAdoptionScoreScale.range.min = 1;
			this.stateManyAdoptionScoreScale.range.max = 10;
		}

		return [ this.stateManyAdoptionScoreScale.range.min, this.stateManyAdoptionScoreScale.range.max ];
	}
}

function setScale(opt){
	return opt.scale
		.domain(opt.domain)
		.range(opt.range);
}

var rootNodes = [];
var projection = d3.geo.albersUsa();

var model = {
	data: "",
	filterByYear: function(year){
		var filteredData; 
		
		filteredData = _(this.data).filter(function(adoption) {
			var adoptedYear;
			adoptedYear = adoption.adopted_year.getYear() + 1900;
			return adoptedYear < year;
		});
		return filteredData;
	},
	filterOutliers: function(data, outlierStatesArray){
		var filteredData;

		filteredData = data.filter(function(adoption){
			 return outlierStatesArray.indexOf(adoption.name) === -1;
		});
		return filteredData;
	},
	groupBy: function(opt){
		return _.groupBy(opt.data, opt.groupBy);
	},
	calculateAdoptionScores: function(dataUntilYear){
		return dataUntilYear.map(function(adoption){
			// (radius of policy circle) = (# of adoption cases) x (first adoption year / state's adopted year)
			var adoptionCases,  // # of states that adopted this policy
				manyAdoptionScore,
				earlyAdoptionScore,
				policyScore,
				firstAdoptionYear = static.policyStartYear[adoption.policy]["policy_start"],
				stateAdoptionYear = adoption.adopted_year.getFullYear();
			
			// Count the number of states that adopted this policy
			adoptionCases = dataUntilYear.filter(function(d){
					return (d.policy === adoption.policy) && 
						(d.adopted_year < stateAdoptionYear);
				}); 
			
			manyAdoptionScore = adoptionCases.length+1;
			earlyAdoptionScore = Math.round(Math.pow((firstAdoptionYear-1650) / (stateAdoptionYear-1650), 10), 1);
	
			return Object.assign(adoption, { "manyAdoptionScore": manyAdoptionScore, "earlyAdoptionScore": earlyAdoptionScore });
		});
	},
	mapStateProperties: function(dataGroupByStateUntilYear){	
		dataGroupByStateUntilYear = Object.keys(dataGroupByStateUntilYear).map(function(state, id){
			var state_obj = {};
			var lat = dataGroupByStateUntilYear[state][0].lat,
				lng = dataGroupByStateUntilYear[state][0].lng,
				permalink = dataGroupByStateUntilYear[state][0].permalink,
				adoptions = dataGroupByStateUntilYear[state];
			
			// adoptions.forEach(function(adoption){ 
			// 	adoption.value = adoption.value; 
			// });	
	
			return { 
				name: state, 
				lat: lat, 
				lng: lng, 
				children: adoptions,
				id: id.toString()
			};
		});

		return dataGroupByStateUntilYear;
	},
	setHierarchy: function(dataGroupByStateUntilYear, yearUntil){
		var _self = this,
			numPolicyAdoptionsArray = [],
			statesInHierarchy;

		statesInHierarchy = dataGroupByStateUntilYear.map(function(state) {
			var stateHierarchy,
				numAdoptedPolicies,
				point = projection([state.lng, state.lat]);
			
			stateHierarchy = d4.hierarchy(state);
			numAdoptedPolicies = stateHierarchy.children.length;
			numPolicyAdoptionsArray.push(numAdoptedPolicies);

			_self.setNumPolicyThreshold(stateHierarchy)
				.sum(function(d){ 
					return scale.policyCircleScale(d.value); 
				});

			var rootSize = stateHierarchy.value,
				pack = d4.pack().size([rootSize, rootSize]).padding(2),
				rootNode = pack(stateHierarchy),
				nodes = rootNode.descendants(),
				filteredNodes = nodes;

			if (nodes.length > 21) { 
				filteredNodes = nodes.slice(0, 20); 
			}
			
			Object.assign(stateHierarchy, {
				x: point[0],
				y: point[1],
				x0: point[0],
				y0: point[1],
				numAdoptedPolicies: numAdoptedPolicies,
				"nodes": filteredNodes
			})        
			return stateHierarchy;      
		});
		// Scale by the number of adopted policies 
		setScale({
			scale: scale.stateManyAdoptionPolicyRadiusScale,
			domain: d4.extent(numPolicyAdoptionsArray),
			range: threshold.setStateManyAdoptionScoreScale(yearUntil)
		});
		console.log(scale.stateManyAdoptionPolicyRadiusScale.domain());

		return statesInHierarchy;
	},
	setNumPolicyThreshold: function(stateHierarchy){
		if(stateHierarchy.children.length > 20) { 
			stateHierarchy.children = stateHierarchy.children.slice(0, 19); 
		}

		return stateHierarchy;
	}
}

//***** Load data *****/
d3.csv("./data/policy_adoptions.csv")
.row(function(d) {
	return {
		policy: d.policy_id,
		lat: parseFloat(d.lat),
		lng: parseFloat(d.long),
		name: d.state,
		state_name: d.state_name,
		value: d.adoption_case,
		adopted_year: new Date(d.adopted_year)
	};
})
.get(function(err, rows) {
	if (err) return console.error(err);
	model.data = rows;
});

svg.call(tip);

var statesInHierarchy, dataGroupByStateUntilYear;
var gStates, circlesData, innerCircles;

var update = function(dataUntilYear, yearUntil){
	svg.selectAll("circle").remove();
	
	var policyThreshold;

	//*** Adjust yearly scale of the size of policy circle from given data
	adjustPolicyCircleScaleYearly(dataUntilYear, yearUntil);
	// Group by state
	dataGroupByStateUntilYear = model.groupBy({
									data: dataUntilYear, 
									groupBy: 'name' 
								})
	dataGroupByStateUntilYear = model.mapStateProperties(dataGroupByStateUntilYear);
	// Define each state as root
	// Convert each state key to an object with functions and properties for hierarchical structure
	statesInHierarchy = model.setHierarchy(dataGroupByStateUntilYear, yearUntil);
	
	//***** Set group elements *****//
	gStates = svg.selectAll(".g_state")
		.data(statesInHierarchy);
	gStates
		.enter().append("g")
		.attr("class", function(d){
			return "g_state g_state_" + d.id;
		});
	gStates
		.exit().remove();

	//***** Set circle elements *****//
	circlesData = gStates.selectAll(".circle")
		.data(function(d){ 
			return d.nodes; 
		});

	circlesData
		.enter().append("circle")
		.attr("class", function(d) { 
			return d.parent ? ("circle circle_policy circle_policy_" + d.data.name) 
							: ("circle outer_circle_state outer_circle_state_" + d.data.name); 
		})
		.style("fill", function(d){
			var statePageRank = static.centrality.centralities[d.data.name]["pageRank"];
			if (d4.select(this).attr("class") === "circle outer_circle_state outer_circle_state_" + d.data.name) {
				
			}
			return d.parent? scale.policyColorScale(d.r) : "white";
		});

	circlesData
		.transition().duration(400)
		.style("fill", function(d){
			var statePageRank = static.centrality.centralities[d.data.name]["pageRank"];
			if (d4.select(this).attr("class") === "circle outer_circle_state outer_circle_state_" + d.data.name) {
				
			}
			return d.parent? scale.policyColorScale(d.r) : scale.stateColorScale(statePageRank);
		})
		.attr("r", function(d){
			// If it's outer state circle, save the radius to "innerCircleRadius"
			// because the whole policy circles should transform in x and y by the radius
			if (d4.select(this).attr("class") === "circle outer_circle_state outer_circle_state_" + d.data.name) {
				var statePageRank, numAdoptedPolicies,
					outerCircleRadius, policyCircleRadius;

				statePageRank = static.centrality.centralities[d.data.name]["pageRank"];
				numAdoptedPolicies = d.numAdoptedPolicies;
				outerCircleRadius = d.r * scale.stateInfRadiusScale(statePageRank) 
										+ scale.stateManyAdoptionPolicyRadiusScale(numAdoptedPolicies) 
										+ scale.stateCircleGlobalScale(numAdoptedPolicies);
				
				if(outerCircleRadius <= 3)
					outerCircleRadius = 5;

				return outerCircleRadius;
			}
			policyCircleRadius = d.r;

			if (policyCircleRadius <= 3)
				policyCircleRadius = 3;

			return policyCircleRadius;
		})
		.attr("cx", function(d){
			var stateCircle, circleRadiusOffset;

			if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + d.data.name) {
				circleRadiusOffset = d4.select(this.parentNode)
								.select(".outer_circle_state")
								.data()[0].r;

				return d.x - circleRadiusOffset;
			}
		})
		.attr("cy", function(d){
			var stateCircle, circleRadiusOffset;
			
			if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + d.data.name) {
				circleRadiusOffset = d4.select(this.parentNode)
								.select(".outer_circle_state")
								.data()[0].r;

				return d.y - circleRadiusOffset;
			}
		})
		.style("stroke", function(d){
			var statePageRank; 
			statePageRank = static.centrality.centralities[d.data.name]["pageRank"];
			
			return isWhichCircle({ 
				parentsExist: d.parent, 
				ifPolicyCircle: "black", 
				ifStateCircle: "none" 
			});
		})
		.style("stroke-width", function(d){
			var statePageRank;
			statePageRank = static.centrality.centralities[d.data.name]["pageRank"];
			
			return isWhichCircle({ 
				parentsExist: d.parent, 
				ifPolicyCircle: 0.5, 
				ifStateCircle: 2 * scale.stateInfStrokeScale(statePageRank) 
			});
		});
		
	circlesData.exit()
		.remove();

	innerCircles = gStates
		.insert("circle", ".outer_circle_state + *")
		.attr("class", "inner_circle")
		.attr("r", function(d){
			return d.r;
		})
		.attr("cx", 0)
		.attr("cy", 0)
		.attr("fill", "white")
		.attr("stroke", function(d){
			return scale.stateInnerColorScale(d.numAdoptedPolicies);
		})
		.attr("stroke-width", function(d){
			return 1 + scale.stateManyAdoptionPolicyRadiusScale(d.numAdoptedPolicies)
					 + scale.stateCircleGlobalScale(d.numAdoptedPolicies);
		});

	force
		.nodes(statesInHierarchy)
		.on("tick", tick)
		.alpha(1)
		.start();

	d4.selectAll(".circle")
		.on("mouseover", function(d){
			console.log("coming in")
			tip.show(d);
		})
		.on("mouseout", function(d){
			tip.hide(d);
		});
}
svg.on("click", function() { zoom([width/2-10, height/2-10, height/2]); });

//*** Functions ***/
function adjustPolicyCircleScaleYearly(dataUntilYear, yearUntil){
	//*** Calculate manyAdoptionScore, and earlyAdoptionScore
	// # of cumulative adoption cases for each policy
	// i.g., How many states adopted the policy by the given year
	// Output: array of adoption object itself... 
	// # of adoption cases will be the size of policy circle
	dataUntilYear = model.calculateAdoptionScores(dataUntilYear);

	// Define the scale of adoptionScoreScale based on scores
	setScale({ 
		scale: scale.adoptionScoreScale, 
		domain: d4.extent(dataUntilYear, function(d){ 
			return d.manyAdoptionScore; 
		}),
		range: [5, 13]
	});

	// Assign final score (manyAdoptionScore * earlyAdoptionScore) in the d.value
	dataUntilYear.map(function(adoption){
		return Object.assign(adoption, { 
			"value": scale.adoptionScoreScale(adoption.manyAdoptionScore) * adoption.earlyAdoptionScore 
		});
	});

	// Define the scale of policy circle based on the final score
	threshold.setPolicyCircle(yearUntil);

	// Scale policy circles based on year-based threshold
	setScale({ 
		scale: scale.policyCircleScale, 
		domain: d4.extent(dataUntilYear.map(function(d){ 
			return d.value; 
		})),
		range: [threshold.policyCircle.min, threshold.policyCircle.max]
	});
}

function zoom(d) {
	var focus0 = focus; focus = d;

	var transition = d3.transition()
		.duration(d3.event.altKey ? 7500 : 750)
		.tween("zoom", function(d) {
			var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + zoomMargin]);
			return function(t) {
				zoomTo(i(t)); 
			};
		});
	}

function zoomTo(v) {
	var diameter = height,
		k = diameter / v[2],
		view = v;
	if(isNaN(v[0])){
		svg.transition().attr("transform", "translate(0,0)")
	} else {
		svg.attr("transform", "translate(" + width/2 + "," + height/2 + ")scale(" + k + ")translate(" + -v[0] + "," + -v[1] + ")")
	}
}

function tick(e) {
	gStates.each(gravity(e.alpha * .1))
		.each(collide(.1))
		.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}

function gravity(k) {
	return function(d) {
		d.x += (d.x0 - d.x) * k;
		d.y += (d.y0 - d.y) * k;
	};
}

function collide(k) {
	var q = d3.geom.quadtree(statesInHierarchy);
	
	return function(node) {
		var gNode = svg.selectAll(".g_state")
				.filter(function(d){
					return d.id == node.id;
				})
		var nodeSize = gNode.node().getBBox().height;
		var nr = nodeSize/1.5 + layout.padding,
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

function isWhichCircle(opt){
	return opt.parentsExist? opt.ifPolicyCircle : opt.ifStateCircle;
}

//*** For slider ***/
var minDateUnix = new Date('1800-01-01').getFullYear();
var maxDateUnix = new Date('2017-12-31').getFullYear();
var step = 60*60*24;

d3.select('#slider3').call(d3.slider()
	.axis(true).min(minDateUnix).max(maxDateUnix)
	.on("slide", function(evt, year) {
		var untilYear = year,
			filteredData;

		d3.select("#current_year").transition()
			.tween("text", function(d) {
				var self = this;
				var i = d3.interpolateRound(Math.floor(d3.select(this).text()), Math.floor(untilYear));
				return function(t) {
					d3.select(this).text(i(t));
				};
			});
		filteredData = model.filterByYear(untilYear);
		filteredData = model.filterOutliers(filteredData, ["HI", "AK"]);
	
		update(filteredData, untilYear);
	})
);


