/**
 * TOFLIT18 Client Sources Per Regions Component
 * =================================================
 *
 * Series of bar charts displaying the amount of data coming from different
 * sources per regions.
 */
import React, { Component } from "react";
import { sortBy } from "lodash";
import { format } from "d3-format";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";

/**
 * Formats.
 */
const NUMBER_FORMAT = format(",");

/**
 * Custom tooltip.
 */
const renderTooltip = name => data => {
  const style = {
    margin: 0,
    padding: 10,
    backgroundColor: "#fff",
    border: "1px solid #ccc",
    whiteSpace: "nowrap",
  };

  return (
    <div style={style}>
      <em className="recharts-tooltip-label">
        {data.label} - {name}
      </em>
      <ul style={{ listStyleType: "none", padding: "0px", margin: "0px" }}>
        {data.payload.map(item => {
          return (
            <li key={item.name}>
              <span>{NUMBER_FORMAT(item.value)} flows</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * Main component.
 */
export default class SourcesPerRegions extends Component {
  render() {
    const unsorted = this.props.data;

    if (!unsorted) return null;

    // // Sorting using the mean share heuristic from RICARDO
    // const sums = {};
    // // sums contains the sum of flows by year
    // unsorted.forEach(d => d.data.forEach(item => {
    //   if (!sums[item.year])
    //     sums[item.year] = 0;
    //   sums[item.year] += item.flows;
    // }));

    // const means = new Array(unsorted.length);

    // unsorted.forEach((d, i) => {
    //   means[i] = d.data.reduce((acc, j) => acc + j.flows, 0) / d.data.length;
    // });

    // const regionIndex = {};

    // unsorted.forEach((d, i) => regionIndex[d.name] = i);

    const data = unsorted; //sortBy(unsorted, d => -means[regionIndex[d.name]]);

    // Computing max values
    // NOTE: clearly not the optimal way to do it...
    let allYears = new Set(),
      allFlows = new Set();

    data.forEach(item => {
      item.data.forEach(({ year, flows }) => {
        allYears.add(year);
        allFlows.add(flows);
      });
    });

    allYears = Array.from(allYears);
    allFlows = Array.from(allFlows);

    const minYear = Math.min.apply(null, allYears),
      maxYear = Math.max.apply(null, allYears);

    const maxFlows = Math.max.apply(null, allFlows);

    const hash = year => year - minYear;

    return (
      <div className="sources-per-regions">
        {data.map(region => {
          const d = new Array(maxYear - minYear + 1);

          for (let i = 0, l = d.length; i < l; i++) d[i] = { year: minYear + i };

          region.data.forEach(line => {
            const h = hash(line.year);
            d[h].flows = line.flows;
          });

          return (
            <div key={region.name}>
              <span>{region.name}</span>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart syncId="sources-per-regions" data={d} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis domain={[0, maxFlows]} />
                  <Tooltip isAnimationActive={false} content={renderTooltip(region.name)} />
                  <Bar dataKey="flows" fill="#4F7178" isAnimationActive={false} minPointSize={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    );
  }
}
