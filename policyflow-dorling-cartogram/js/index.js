var margin = {top: 0, right: 0, bottom: 0, left: 0},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom,
    padding = 10;

var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
var policyCircleScale, stateCircleScale,
    stateInfScale,
    rootNodes = [];

var projection = d3.geo.albersUsa();

var radius = d3.scale.sqrt()
    .domain([0, .222])
    .range([0, 30]);

var force = d3.layout.force()
    .charge(0)
    .gravity(0)
    .size([width, height]);

policyColorScale = d4.scaleLinear()     // constant over time
    .range(["yellow","#f00"])
    .domain([0, 5]);
stateCircleScale = d4.scaleLinear().range([10, 40]);
stateColorScale = d4.scaleLinear()  // state circle color depends on state's influence score
            .range(["#fffea4","#df0000"])
            .domain(d4.extent(Object.values(Object.values(static.centrality)[0]).map(function(d){ return d.pageRank; })));
stateInfScale = d4.scaleLinear()
    .range([1, 1.5])
    .domain(d4.extent(Object.values(Object.values(static.centrality)[0]).map(function(d){ return d.pageRank; })));

d3.json("./data/us-state-centroids.json", function(error, states) {
  if (error) throw error;

  var dataset, nodes, node;

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
    var forceSimulation = force.on("tick", tick);
    
    var update = function (dataUntilYear) {
        var policyThreshold;
        //*** Calculate # of cumulative adoption cases for each policy
        // i.g., How many states adopted the policy by the given year
        // Output: array of adoption object itself... 
        // # of adoption cases will be the size of policy circle
        dataUntilYear.map(function(adoption){
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
            earlyAdoptionScore = Math.round(Math.pow((stateAdoptionYear-1650) / (firstAdoptionYear-1650), 10), 1);

            return Object.assign(adoption, { "value": manyAdoptionScore * earlyAdoptionScore });
        });

        var statesInHierarchy;
        var allAdoptions = [];

        dataGroupByStateUntilYear = _.groupBy(dataUntilYear, 'state');
        Object.keys(dataGroupByStateUntilYear).forEach(function(state){
            allAdoptions.concat(dataGroupByStateUntilYear[state].adopted_cases);
        });

        dataGroupByStateUntilYear = Object.keys(dataGroupByStateUntilYear).map(function(state){
            var state_obj = {};
            var lat = dataGroupByStateUntilYear[state][0].lat,
                lng = dataGroupByStateUntilYear[state][0].lng,
                permalink = dataGroupByStateUntilYear[state][0].permalink,
                adoptions = dataGroupByStateUntilYear[state];
            
            // adoptions.forEach(function(adoption){ 
            //     adoption.value = policyCircleScale(adoption.value); 
            // });
            
            return { 
                'name': state, 
                'lat': lat, 
                'lng': lng, 
                'children': adoptions 
            };
        });

        // Define each state as root
        // Convert each state key to an object with functions and properties for hierarchical structure
        statesInHierarchy = dataGroupByStateUntilYear.map(function (state){
            var stateHierarchy,
                point = projection([state.lng, state.lat]),
                coordObj = {
                    x: point[0],
                    y: point[1],
                    x0: point[0],
                    y0: point[1],
                    r: radius(.111)
                }
            
            stateHierarchy = d4.hierarchy(state)
                .sum(function(d){ 
                    return d.value/5; 
                });
            
            Object.assign(stateHierarchy, coordObj)        
            return stateHierarchy;      
        });

        nodes = states.features
            .map(function(d) {
                console.log(d);
                var point = projection(d.geometry.coordinates);
                return {
                    x: point[0], y: point[1],
                    x0: point[0], y0: point[1],
                    r: radius(.111)
                };
            });

        node = svg.selectAll(".g_state")
            .data(statesInHierarchy)
            .enter().append("g")
            .attr("class", function(d){
                return "g_state g_state_" + d.data.name;
            });
        
            //*** Update circles with updated data
        statesInHierarchy.forEach(function(state){
            var pack, rootSize,
                gState,
                nodes, circles, circlesData;
            
            // innerCircleRadius = simple sum of policy circle radius
            var innerCircle, outerCircle,
                innerCircleRadius, outerCircleRadius,
                stateInHierarchy = [state],
                stateName = state.data.name,
                statePageRank = static.centrality.centralities[stateName]["pageRank"];
            
            // state.children.filter(function(d){
            //     return poli
            // })
            
            rootSize = state.value,  // Update the size of root circle according to the summed value
            pack = d4.pack().size([rootSize, rootSize]).padding(2),
            gState = svg.selectAll(".g_state_" + stateName),
            rootNode = pack(state),
            // Filter...
            nodes = rootNode.descendants(),
            circlesData = gState.selectAll(".circle")
                            .data(nodes);

            // Set the state circles to the fixed coordinate with summed radius
            circlesData.enter()
                .append("circle")
                .attr("class", function(d) { 
                    return d.parent ? ("circle circle_policy circle_policy_" + stateName) 
                                    : ("circle outer_circle_state outer_circle_state_" + stateName); 
                })
                
            
            circlesData
                .transition().duration(400)
                .style("fill", function(d){
                    return d.parent? policyColorScale(d.r) : stateColorScale(statePageRank);
                })
                .attr("r", function(d){
                    // If it's outer state circle, save the radius to "innerCircleRadius"
                    // because the whole policy circles should transform in x and y by the radius
                    if (d4.select(this).attr("class") === "circle outer_circle_state outer_circle_state_" + stateName) {
                        innerCircleRadiusOffset = d.r;
                        innerCircleRadius = d.r;
                        outerCircleRadius = innerCircleRadius * stateInfScale(statePageRank);
                        return outerCircleRadius;
                    }
                    if(d.r > 10) { console.log(d.r); }
                    var policyCircleRadius = d.r;
                    return policyCircleRadius;
                })
                .attr("cx", function(d){
                    if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + stateName) {
                        return d.x - innerCircleRadiusOffset;
                    }
                })
                .attr("cy", function(d){
                    if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + stateName) {
                        return d.y - innerCircleRadiusOffset;
                    }
                })
                .style("stroke", "none");
            
            circlesData.exit()
                .remove();

            outerCircle = gState.select(".outer_circle_state")
                .style("fill", stateColorScale(statePageRank));
            innerCircle = gState.selectAll(".inner_circle_state")
                    .data(stateInHierarchy);
            
            innerCircle
                .enter().insert("circle", ".outer_circle_state + *")    // Put inner circle right after outer circle
                .attr("class", "inner_circle_state")
                .attr("cx", function(d){ 
                    return outerCircle.attr("cx"); })
                .attr("cy", function(d){ return outerCircle.attr("cy"); })
                .attr("r", function(d){ return innerCircleRadius; });
            
            innerCircle.transition().duration(400)
                .attr("cx", function(d){ return outerCircle.attr("cx"); })
                .attr("cy", function(d){ return outerCircle.attr("cy"); })
                .attr("r", function(d){ return innerCircleRadius; });
            
            innerCircle.exit()
                .remove();
        });
        forceSimulation.nodes(statesInHierarchy).start();
    };

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

    //*** Functions ***/
    function addCircles(sel) {
        sel.selectAll("circle")
            .data([1])
            .enter()
            .append("circle")
            .attr("cx", function(d) { return d * 10; })
            .attr("cy", function(d) { return d * 10; })
            .attr("r", 3);
    }
    function tick(e) {
        node.each(gravity(e.alpha * .1))
            .each(collide(.99))
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
                var nr = node.r + padding,
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
});