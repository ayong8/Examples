var margin = {top: 0, right: 0, bottom: 0, left: 0},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom,
    padding = 10,
    view = [width/2, height/2, height/2],
    zoomMargin = 30;

var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var tip = d4.tip()
    .attr("class", "d3-tip")
    .offset([-10, 0])
    .html(function(d) {
      //return xCat + ": " + d[xCat] + "<br>" + yCat + ": " + d[yCat];
      return d.parent? ("Policy_id" + ": " + d.data.policy)
                : ("State: " + d.data.name);
    });
var policyCircleScale, stateCircleScale,
    stateInfScale,
    rootNodes = [];

var projection = d3.geo.albersUsa();

var radius = d3.scale.sqrt()
    .domain([0, .222])
    .range([0, 30]);



adoptionScoreScale = d4.scaleQuantile()
    .range([5, 13]);
policyCircleScale = d4.scaleLinear();   // changes over time
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


var dataset, node;
var statesInHierarchy;
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

    svg.call(tip);
    var update = function (dataUntilYear) {
        var force = d3.layout.force()
            .charge(0)
            .gravity(0)
            .size([width, height]);

        var forceSimulation = force.on("tick", tick);
        
        //d3.selectAll(".g_state").remove();
        var policyThreshold;
        

        //*** Adjust yearly scale of the size of policy circle from given data
        adjustPolicyCircleScaleYearly(dataUntilYear);
        var allAdoptions = [];

        dataGroupByStateUntilYear = _.groupBy(dataUntilYear, 'state');
        // Object.keys(dataGroupByStateUntilYear).forEach(function(state){
        //     allAdoptions.concat(dataGroupByStateUntilYear[state].adopted_cases);
        // });

        dataGroupByStateUntilYear = Object.keys(dataGroupByStateUntilYear).map(function(state){
            var state_obj = {};
            var lat = dataGroupByStateUntilYear[state][0].lat,
                lng = dataGroupByStateUntilYear[state][0].lng,
                permalink = dataGroupByStateUntilYear[state][0].permalink,
                adoptions = dataGroupByStateUntilYear[state];
            
            adoptions.forEach(function(adoption){ 
                adoption.value = adoption.value; 
            });
            //console.log(adoptions.map(function(d){ return d.value; }));
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
                    y0: point[1]
                }
            
            stateHierarchy = d4.hierarchy(state);

            if(stateHierarchy.children.length > 20) { 
                stateHierarchy.children = stateHierarchy.children.slice(0, 19); 
            }

            stateHierarchy
                .sum(function(d){ 
                    return policyCircleScale(d.value); 
                });
            
            Object.assign(stateHierarchy, coordObj)        
            return stateHierarchy;      
        });

        forceSimulation.nodes(statesInHierarchy).start();

        gStates = svg.selectAll(".g_state")
            .data(statesInHierarchy);

        gStates.enter().append("g")
            .attr("class", function(d){
                return "g_state g_state_" + d.data.name;
            })
            .append("text")
            .attr("x", 0)
            .attr("y", 0)
            .text("dd");

        // gStates
        //     .transition().duration(200);

        // gStates.exit().remove();


            // .each(function(state){
            //     var gState = d4.select(this);
            //     var pack, rootSize,
            //         nodes, circles, circlesData;
                
            //     // innerCircleRadius = simple sum of policy circle radius
            //     var innerCircle, outerCircle,
            //         innerCircleRadius, outerCircleRadius,
            //         stateInHierarchy = [state],
            //         stateName = state.data.name,
            //         statePageRank = static.centrality.centralities[stateName]["pageRank"];

            //     rootSize = state.value,  // Update the size of root circle according to the summed value
            //     pack = d4.pack().size([rootSize, rootSize]).padding(2),
            //     gState = svg.selectAll(".g_state_" + stateName),
            //     rootNode = pack(state),
            //     nodes = rootNode.descendants();

            //     if (nodes.length > 21) { nodes = nodes.slice(0, 20); }

            //     circlesData = gState.selectAll(".circle")
            //                 .data(nodes);

            //     // Set the state circles to the fixed coordinate with summed radius
            //     circlesData.enter()
            //         .append("circle")
            //         .attr("class", function(d) { 
            //             return d.parent ? ("circle circle_policy circle_policy_" + stateName) 
            //                             : ("circle outer_circle_state outer_circle_state_" + stateName); 
            //         })
            //         .style("fill", function(d){
            //             return d.parent? policyColorScale(d.r) : stateColorScale(statePageRank);
            //         })
            //         .attr("r", function(d){
            //             // If it's outer state circle, save the radius to "innerCircleRadius"
            //             // because the whole policy circles should transform in x and y by the radius
            //             if (d4.select(this).attr("class") === "circle outer_circle_state outer_circle_state_" + stateName) {
            //                 innerCircleRadiusOffset = d.r;
            //                 innerCircleRadius = d.r;
            //                 outerCircleRadius = innerCircleRadius * stateInfScale(statePageRank);
            //                 return outerCircleRadius;
            //             }
            //             var policyCircleRadius = d.r;
            //             return policyCircleRadius;
            //         })
            //         .attr("cx", function(d){
            //             if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + stateName) {
            //                 return d.x - innerCircleRadiusOffset;
            //             }
            //         })
            //         .attr("cy", function(d){
            //             if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + stateName) {
            //                 return d.y - innerCircleRadiusOffset;
            //             }
            //         })
            //         .style("stroke", "none");
            
            //     circlesData
            //         .transition().duration(400)
            //         .style("fill", function(d){
            //             return d.parent? policyColorScale(d.r) : stateColorScale(statePageRank);
            //         })
            //         .attr("r", function(d){
            //             // If it's outer state circle, save the radius to "innerCircleRadius"
            //             // because the whole policy circles should transform in x and y by the radius
            //             if (d4.select(this).attr("class") === "circle outer_circle_state outer_circle_state_" + stateName) {
            //                 innerCircleRadiusOffset = d.r;
            //                 innerCircleRadius = d.r;
            //                 outerCircleRadius = innerCircleRadius * stateInfScale(statePageRank);
            //                 return outerCircleRadius;
            //             }
            //             var policyCircleRadius = d.r;
            //             return policyCircleRadius;
            //         })
            //         .attr("cx", function(d){
            //             if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + stateName) {
            //                 return d.x - innerCircleRadiusOffset;
            //             }
            //         })
            //         .attr("cy", function(d){
            //             if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + stateName) {
            //                 return d.y - innerCircleRadiusOffset;
            //             }
            //         })
            //         .style("stroke", "none");
                
            //     circlesData.exit()
            //         .remove();
                
            //     d4.selectAll(".circle")
            //         .on("mouseover", function(d){
            //             console.log("coming in")
            //             tip.show(d);
            //         })
            //         .on("mouseout", function(d){
            //             tip.hide(d);
            //         });
            // });

            // gStates
            //     .transition().duration(200)
            //     .each(function(state){
            //         var gState = d4.select(this);
            //         var pack, rootSize,
            //             nodes, circles, circlesData;
                    
            //         // innerCircleRadius = simple sum of policy circle radius
            //         var innerCircle, outerCircle,
            //             innerCircleRadius, outerCircleRadius,
            //             stateInHierarchy = [state],
            //             stateName = state.data.name,
            //             statePageRank = static.centrality.centralities[stateName]["pageRank"];

            //         circlesData = gState.selectAll(".circle");
                        
            //         circlesData
            //             .transition().duration(400)
            //             .style("fill", function(d){
            //                 return d.parent? policyColorScale(d.r) : stateColorScale(statePageRank);
            //             })
            //             .attr("r", function(d){
            //                 // If it's outer state circle, save the radius to "innerCircleRadius"
            //                 // because the whole policy circles should transform in x and y by the radius
            //                 if (d4.select(this).attr("class") === "circle outer_circle_state outer_circle_state_" + stateName) {
            //                     innerCircleRadiusOffset = d.r;
            //                     innerCircleRadius = d.r;
            //                     outerCircleRadius = innerCircleRadius * stateInfScale(statePageRank);
            //                     return outerCircleRadius;
            //                 }
            //                 var policyCircleRadius = d.r;
            //                 return policyCircleRadius;
            //             })
            //             .style("stroke", "none");
                    
            //         circlesData.exit()
            //             .remove();
            //     });

            //     gStates.exit().remove();

        
        // //*** Update circles with updated data
        // statesInHierarchy.forEach(function(state){
        //     var pack, rootSize,
        //         gState,
        //         nodes, circles, circlesData;
            
        //     // innerCircleRadius = simple sum of policy circle radius
        //     var innerCircle, outerCircle,
        //         innerCircleRadius, outerCircleRadius,
        //         stateInHierarchy = [state],
        //         stateName = state.data.name,
        //         statePageRank = static.centrality.centralities[stateName]["pageRank"];
            
        //     rootSize = state.value,  // Update the size of root circle according to the summed value
        //     pack = d4.pack().size([rootSize, rootSize]).padding(2),
        //     gState = svg.selectAll(".g_state_" + stateName),
        //     rootNode = pack(state),
        //     nodes = rootNode.descendants();

        //     if (nodes.length > 21) { nodes = nodes.slice(0, 20); }

        //     circlesData = gState.selectAll(".circle")
        //                     .data(nodes);

        //     // Set the state circles to the fixed coordinate with summed radius
        //     circlesData.enter()
        //         .append("circle")
        //         .attr("class", function(d) { 
        //             return d.parent ? ("circle circle_policy circle_policy_" + stateName) 
        //                             : ("circle outer_circle_state outer_circle_state_" + stateName); 
        //         })
                
            
        //     circlesData
        //         .transition().duration(400)
        //         .style("fill", function(d){
        //             return d.parent? policyColorScale(d.r) : stateColorScale(statePageRank);
        //         })
        //         .attr("r", function(d){
        //             // If it's outer state circle, save the radius to "innerCircleRadius"
        //             // because the whole policy circles should transform in x and y by the radius
        //             if (d4.select(this).attr("class") === "circle outer_circle_state outer_circle_state_" + stateName) {
        //                 innerCircleRadiusOffset = d.r;
        //                 innerCircleRadius = d.r;
        //                 outerCircleRadius = innerCircleRadius * stateInfScale(statePageRank);
        //                 return outerCircleRadius;
        //             }
        //             var policyCircleRadius = d.r;
        //             return policyCircleRadius;
        //         })
        //         .attr("cx", function(d){
        //             if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + stateName) {
        //                 return d.x - innerCircleRadiusOffset;
        //             }
        //         })
        //         .attr("cy", function(d){
        //             if (d4.select(this).attr("class") !== "circle outer_circle_state outer_circle_state_" + stateName) {
        //                 return d.y - innerCircleRadiusOffset;
        //             }
        //         })
        //         .style("stroke", "none");
            
        //     circlesData.exit()
        //         .remove();
            
        //     d4.selectAll(".circle")
        //         .on("mouseover", function(d){
        //             console.log("coming in")
        //             tip.show(d);
        //         })
        //         .on("mouseout", function(d){
        //             tip.hide(d);
        //         });
            
        //     outerCircle = gState.select(".outer_circle_state");

        //     innerCircle = gState.selectAll(".inner_circle_state")
        //             .data(stateInHierarchy);
            
        //     innerCircle
        //         .enter().insert("circle", ".outer_circle_state + *")    // Put inner circle right after outer circle
        //         .attr("class", "inner_circle_state")
        //         .attr("cx", function(d){ 
        //             return outerCircle.attr("cx"); })
        //         .attr("cy", function(d){ return outerCircle.attr("cy"); })
        //         .attr("r", function(d){ return innerCircleRadius; });
            
        //     innerCircle.transition().duration(400)
        //         .attr("cx", function(d){ return outerCircle.attr("cx"); })
        //         .attr("cy", function(d){ return outerCircle.attr("cy"); })
        //         .attr("r", function(d){ return innerCircleRadius; });
            
        //     innerCircle.exit()
        //         .remove();
            
        //     //*** Click event for outer circle
        //     gState.selectAll(".outer_circle_state")
        //         .on("click", function(d) {
        //             var transform = d3.transform(d4.select(this.parentNode).attr("transform")),
        //                 focusInfo = {
        //                     "x": transform.translate[0],
        //                     "y": transform.translate[1],
        //                     "r": d.r
        //                 }    

        //             if(focus !== rootNode) zoom(focusInfo), d3.event.stopPropagation(); 
        //         });
        // });

        // svg.selectAll(".outer_circle_state")
        //     .each(function(d){
        //         d4.select(this)
        //         // .style("fill", stateColorScale(statePageRank))
        //         .attr("r", function(d){
        //             var policyCircleRadius = [];
        //             d4.select(this.parentNode)
        //                 .selectAll(".circle_policy")
        //                 .each(function(d){
        //                     policyCircleRadius.push(d4.select(this).attr("r"));
        //                 });
        //             console.log(policyCircleRadius);
        //             console.log(d4.max(policyCircleRadius));
        //             return d4.max(policyCircleRadius)* 100;
        //         })
        //     });
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

    // Zoomout event
    svg.on("click", function() { 
        zoom([width/2-10, height/2-10, height/2]); });

    //*** Functions ***/
    function adjustPolicyCircleScaleYearly(dataUntilYear){
        var policyCircleMin, policyCircleMax;

        //*** Calculate manyAdoptionScore, and earlyAdoptionScore
        // # of cumulative adoption cases for each policy
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
            earlyAdoptionScore = Math.round(Math.pow((firstAdoptionYear-1650) / (stateAdoptionYear-1650), 10), 1);

            return Object.assign(adoption, { "manyAdoptionScore": manyAdoptionScore, "earlyAdoptionScore": earlyAdoptionScore });
        });

        // Define the scale of adoptionScoreScale based on scores
        adoptionScoreScale.domain(d4.extent(dataUntilYear, function(d){ return d.manyAdoptionScore; }));
        console.log("adoptionScoreScale domain:", adoptionScoreScale.domain());
        console.log("adoptionScoreScale range:",adoptionScoreScale.range());
        // Assign final score (manyAdoptionScore * earlyAdoptionScore) in the d.value
        dataUntilYear.map(function(adoption){
            return Object.assign(adoption, { "value": adoptionScoreScale(adoption.manyAdoptionScore) * adoption.earlyAdoptionScore });
        });

        // Define the scale of policy circle based on the final score
        policyCircleMax = 3;
        policyCircleMin = policyCircleMax / 3;
        policyCircleScale
            .range([policyCircleMin, policyCircleMax])
            .domain(d4.extent(dataUntilYear.map(function(d){ return d.value; })));
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
    
        //*** Draw the whole state circle
        // Prepare the whole state data
    
        d3.select(".g_state_CA").selectAll("circle").style("stroke-width", "0.2");
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
});

function tick(e) {
    gStates.each(gravity(e.alpha * .1))
        .each(collide(.9))
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

    // d4.selectAll("circle")
    //     .attr("cx", function(d){ return d.x; })
    //     .attr("cy", function(d){ return d.y; })
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