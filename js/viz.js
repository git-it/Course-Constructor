function getTops(source_group, num_top) {
  return {
      all: function () {
          return source_group.top(num_top);
      }
  };
}
function changeValueAccessor(chart, attribute) {
  var redraw = (attribute && attribute.hasOwnProperty('redraw') ?
    attribute.redraw : true);
  console.log("changeValueAccessor", attribute, redraw);

  chart.valueAccessor(
    function (d) {
      return d.value[attribute.name];
    }
  ).colorDomain(
    dataRanges[attribute.name]
  ).title(
    function (d) {
      console.log(d);
      return "Fragment: " + d.key + "\n " + attribute.label +": " + decformat(d.value) +' '+ attribute.units;
    }
  );

  if (redraw) {
    $('[rel="metric"').html(attribute.label);
    var chartFilter = chart.filter();
    chart.filter(null)
         .filter(chartFilter);
    dc.redrawAll();
  }
}

const processVizData = (data) => {
  ndx = crossfilter(data);

  var all = ndx.groupAll(),
    addWeightedMean = function (prevValue, newValue, count) {
      return ((prevValue * (count - 1)) + newValue) / count;
    },
    rmWeightedMean = function (prevValue, oldValue, count) {
      if (count === 0) {
        return 0;
      } else {
        return ((prevValue * (count + 1)) - oldValue) / count;
      }
    };
  dimensions.data = ndx.dimension(
    function (d) {
      return d.fragment;
    }
  );

  groups.data = dimensions.data
    .group()
    .reduce(
      function reduceAdd(p, v) {
        p.count       += 1;
        p.t            = addWeightedMean(p.t, v.t, p.count);
        p.dist         = addWeightedMean(p.dist, v.dist, p.count);
        p.meter_per_hour        = addWeightedMean(p.meter_per_hour, v.meter_per_hour, p.count);
        p.quad_speed  += Math.pow(v.meter_per_hour, 2);
        p.speed_std    = (p.count > 1 ? Math.sqrt(Math.pow(p.meter_per_hour, 2) - (p.quad_speed / p.count)) : 0);
        p.dist_km          = addWeightedMean(p.dist_km, v.dist_km, p.count);
        p.bearing         = addWeightedMean(p.bearing, v.bearing, p.count);
        p.abs_bank_diff    = addWeightedMean(p.abs_bank_diff, v.abs_bank_diff, p.count);
        p.radius       = addWeightedMean(p.radius, v.radius, p.count);
        p.radius_group = addWeightedMean(p.radius_group, v.radius_group, p.count);

        return p;
      },
      function reduceRemove(p, v) {
        // console.log(p, v);

        p.count       -= 1;
        p.t            = rmWeightedMean(p.t, v.t, p.count);
        p.dist         = rmWeightedMean(p.dist, v.dist, p.count);
        p.meter_per_hour        = rmWeightedMean(p.meter_per_hour, v.meter_per_hour, p.count);
        p.quad_speed  -= Math.pow(v.meter_per_hour, 2);
        p.speed_std    = (p.count > 1 ? Math.sqrt(Math.pow(p.meter_per_hour, 2) - (p.quad_speed / p.count)) : 0);
        p.dist_km          = rmWeightedMean(p.dist_km, v.dist_km, p.count);
        p.bearing         = rmWeightedMean(p.bearing, v.bearing, p.count);
        p.abs_bank_diff    = rmWeightedMean(p.abs_bank_diff, v.abs_bank_diff, p.count);
        p.radius       = rmWeightedMean(p.radius, v.radius, p.count);
        p.radius_group = rmWeightedMean(p.radius_group, v.radius_group, p.count);

        return p;
      },
      function reduceInit() {
        return {
          count: 0,
          t: 0,
          dist: 0,
          meter_per_hour: 0,
          quad_speed: 0,
          speed_std: 0,
          dist_km: 0,
          bearing: 0,
          abs_bank_diff: 0,
          radius: 0,
          radius_group: 0
        };
      }
    );

dimensions.user = ndx.dimension(
  function (d) {
    return d.user;
  }
);

allDim = ndx.dimension(function(d) {return d;});

groups.user = dimensions.user.group();

dimensions.bearing = ndx.dimension(
  function (d) {
    return Math.floor(d.bearing / 5) * 5;
  }
);

groups.bearing = dimensions.bearing.group();

dimensions.speed = ndx.dimension(
  function (d) {
    return Math.floor(d.meter_per_hour / 10) * 10;
  }
);

dataRanges.bearing = d3.extent(
  groups.data.all(),
  function (d) {
    return d.value.bearing;
  }
);

groups.speed = dimensions.speed.group();

dataRanges.speed = d3.extent(
  groups.data.all(),
  function (d) {
    console.log('data ranges: ', d.value);
    return d.value.speed;
  }
);

dimensions.dist_km = ndx.dimension(
  function (d) {
    return Math.floor(d.dist_km);
  }
);

groups.dist_km = dimensions.dist_km.group();

dataRanges.dist_km = d3.extent(
  groups.data.all(),
  function (d) {
    return d.value.dist_km;
  }
);

bcDriver
  .dimension(dimensions.user)
  .group(getTops(groups.user,15)) //groups.user)
  .margins(margins)
  .x(
    d3.scaleOrdinal()
      .range([1, 2])
  )
  .y(
    d3.scaleLinear()
      .domain(
        d3.extent(
          groups.user.all(),
          function (d) {
            return d.value;
          }
        )
      )
  )
  .elasticX(true)
  .elasticY(true)
  .xAxisLabel('User ID')
  .gap(10)
  .yAxisLabel('segments')
  .xUnits(dc.units.ordinal);

// bcDriver
//   .xAxis()
//   .tickValues(['Racer', 'Journalist']);
//   console.log('bcDriver--',bcDriver);

bcRad
  .dimension(dimensions.bearing)
  .group(groups.bearing)
  .margins(margins)
  .x(
    d3.scaleLinear()
      .range([0, 18])
      .domain([0, 70])
  )
  .y(
    d3.scaleLinear()
      .domain(
        d3.extent(
          groups.bearing.all(),
          function (d) {
            return d.value;
          }
        )
      )
  )
  .elasticX(true)
  .elasticY(true)
  .xAxisLabel('bearing (degrees)')
  .yAxisLabel('segments');

  console.log('bcRad (bearing)--',bcRad);

bcSpeed
  .dimension(dimensions.speed)
  .group(groups.speed)
  .margins(margins)
  .x(
    d3.scaleLinear()
      .domain(
        d3.extent(
          groups.speed.all(),
          function (d) {
            return d.key;
          }
        )
      )
  )
  .y(
    d3.scaleLinear()
      .domain(
        d3.extent(
          groups.speed.all(),
          function (d) {
            return d.value;
          }
        )
      )
  )
  .xAxisLabel('Speed (km/h)')
  .yAxisLabel('segments')
  .elasticX(true)
  .elasticY(true);

  console.log('bcSpeed--',bcSpeed);


bcAcc
  .dimension(dimensions.dist_km)
  .group(groups.dist_km)
  .margins(margins)
  .x(
    d3.scaleLinear()
      .domain(
        d3.extent(
          groups.dist_km.all(),
          function (d) {
            return d.key;
          }
        )
      )
  )
  .y(
    d3.scaleLinear()
      .domain(
        d3.extent(
          groups.dist_km.all(),
          function (d) {
            return d.value;
          }
        )
      )
  )
  .xAxisLabel('distance (km)')
  .yAxisLabel('segments')
  .elasticX(true)
  .elasticY(true);

  console.log('bcAcc--',bcAcc);
  
dataTable
  .dimension(allDim)
  .group(function (d) { return 'dc.js insists on putting a row here so I remove it using JS'; })
  .size(Infinity)
  .showSections(false)

  dc.renderAll();
}