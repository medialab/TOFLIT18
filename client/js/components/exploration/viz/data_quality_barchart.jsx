/**
 * TOFLIT18 Data Quality Bar Chart Component
 * ==========================================
 *
 * A brushable component displaying a bar chart showing periods of time when
 * data is actually existing.
 */
import React, {Component} from 'react';
import measured from '../../../lib/measured';
import scale from 'd3-scale';

/**
 * Main component
 */
@measured
export default class DataQualityBarChart extends Component {
  render() {
    const {data, width} = this.props;

    if (!width)
      return null;

    // Building scales
    const x = scale.ordinal().range([0, width]),
          y = scale.linear().range([200, 0]);

    return (
      <svg width="100%" height={200} className="quality-bar-chart">
        {data.map((row, i) =>
          <rect key={i}
                className="bar"
                x={x(i)}
                width={50}
                height={50} />)}
      </svg>
    );
  }
}


  // svg.selectAll(".bar")
  //     .data(data)
  //   .enter().append("rect")
  //     .attr("class", "bar")
  //     .attr("x", function(d) { return x(d.letter); })
  //     .attr("width", x.rangeBand())
  //     .attr("y", function(d) { return y(d.frequency); })
  //     .attr("height", function(d) { return height - y(d.frequency); });
