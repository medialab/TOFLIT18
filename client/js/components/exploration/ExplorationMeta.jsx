/**
 * TOFLIT18 Client Meta Viz Display
 * =================================
 *
 * Displaying a collection of visualizations dealing with the sources
 * themselves and how they interact with each other.
 */
import React, {Component} from 'react';
import {Waiter} from '../misc/Loaders.jsx';
import {ClassificationSelector, ItemSelector} from '../misc/Selectors.jsx';
import {branch} from 'baobab-react/decorators';
import DataQualityBarChart from './viz/DataQualityBarChart.jsx';
import SourcesPerDirections from './viz/SourcesPerDirections.jsx';

import {exportCSV} from '../../lib/exports';
import VizLayout from '../misc/VizLayout.jsx';
import {prettyPrint} from '../../lib/helpers';

import specs from '../../../specs.json';

import {
  select,
  updateSelector as update,
  addChart
} from '../../actions/metadata';

/**
 * Helper used to get the child classifications of the given classification.
 */
function getChildClassifications(index, target) {
  const children = [];

  if (!target.children || !target.children.length)
    return children;

  const stack = target.children.slice();

  while (stack.length) {
    const child = stack.pop();

    children.push(child);

    if (child.children)
      stack.push.apply(stack, child.children);
  }

  return children;
}

const metadataSelectors = (specs.metadataSelectors || []).map(option => {
  return {
    ...option,
    special: true
  };
});

function formatArrayToCSV(data) {
  const newArray = [];

  data.forEach((d) =>
    d.data.forEach((e) =>
      newArray.push({
        name: d.name,
        flows: e.flows,
        year: e.year
      })
    )
  );

  return newArray;
}

@branch({
  actions: {
    select,
    update,
    addChart
  },
  cursors: {
    classifications: ['data', 'classifications', 'flat'],
    classificationIndex: ['data', 'classifications', 'index'],
    directions: ['data', 'directions'],
    sourceTypes: ['data', 'sourceTypes'],
    state: ['states', 'exploration', 'metadata']
  }
})
export default class ExplorationMeta extends Component {
  exportPerYear() {
    const {state} = this.props;
    exportCSV({
      data: state.perYear,
      name: `Toflit18_Meta_view ${state.dataType.name} - ${state.fileName} data_per_year.csv`,
    });
  }
  exportFlows() {
    const {state} = this.props;
    exportCSV({
      data: formatArrayToCSV(state.flowsPerYear || []),
      name: `Toflit18_Meta_view ${state.dataType.name} - ${state.fileName} flows_per_year.csv`,
    });
  }

  render() {
    const {
      actions,
      classifications,
      classificationIndex,
      directions,
      sourceTypes,
      state
    } = this.props;

    const {
      groups,
      selectors
    } = state;

    const classificationsFiltered = classifications.product
      .concat(classifications.country)
      .filter(c => c.groupsCount)
      .map(e => ({
        ...e,
        name: `${e.name} (${e.model === 'product' ? 'Products' : 'Countries'} - ${prettyPrint(e.groupsCount)} groups)`
      }));

    const canDisplaySecondViz = (
      state.dataType &&
      (
        (state.flowsPerYear && state.flowsPerYear.length < specs.metadataGroupMax) ||
        state.dataType.special
      )
    );

    const sourceTypesOptions = (sourceTypes || []).map(type => {
      return {
        name: type,
        value: type
      };
    });

    // Computing bar chart's data
    let barData = [];

    if (state.perYear && state.perYear.length) {
      const minYear = state.perYear[0].year;

      const maxYear = state.perYear[state.perYear.length - 1].year;

      barData = new Array(maxYear - minYear + 1);

      const hash = year => year - minYear;

      for (let i = 0, l = barData.length; i < l; i++)
        barData[i] = {year: minYear + i};

      state.perYear.forEach(line => {
        const h = hash(line.year);
        barData[h].data = line.data;
      });
    }

    let unit = 'classified items';

    if (state.dataType && state.dataType.value === 'sourceType')
      unit = 'source types';
    if (state.dataType && state.dataType.value === 'direction')
      unit = 'directions';

    let childClassifications;

    if (state.dataType && !!state.dataType.model)
      childClassifications = getChildClassifications(classificationIndex, state.dataType);

    return (
      <VizLayout
        title="Metadata"
        description="Some information about the data itself."
        leftPanelName="Filters"
        rightPanelName="Caption" >
        { /* Top of the left panel */ }
        <div className="box-selection box-selection-lg">
          <h2 className="hidden-xs"><span className="hidden-sm hidden-md">The type of </span><span>data</span></h2>
          <div className="form-group">
            <label htmlFor="classifications" className="control-label sr-only">Type of data</label>
            <ItemSelector
              type="dataType"
              data={[...metadataSelectors, ...classificationsFiltered]}
              loading={!classifications.product.length}
              onChange={actions.select}
              selected={state.dataType} />
          </div>
          <div className="form-group">
            <label htmlFor="classifications" className="control-label">Source Type</label>
            <ItemSelector
              type="sourceType"
              data={sourceTypesOptions}
              loading={!sourceTypesOptions.length}
              onChange={actions.update.bind(null, 'sourceType')}
              selected={selectors.sourceType} />
          </div>
        </div>

        { /* Left panel */ }
        <div className="aside-filters">
          <h3>Filters</h3>
          <form onSubmit={e => e.preventDefault()}>
            <div className="form-group">
              <label htmlFor="product" className="control-label">{
                (state.dataType && state.dataType.model === 'product') ? 'Child product' : 'Product'
              }</label>
              <small className="help-block">The type of product being shipped.</small>
              <ClassificationSelector
                type="product"
                loading={!classifications.product.length}
                data={childClassifications || classifications.product.filter(c => !c.source)}
                onChange={actions.update.bind(null, 'productClassification')}
                selected={selectors.productClassification} />
              <ItemSelector
                type="product"
                disabled={!selectors.productClassification || !groups.product.length}
                loading={selectors.productClassification && !groups.product.length}
                data={groups.product}
                onChange={actions.update.bind(null, 'product')}
                selected={selectors.product} />
            </div>
            <div className="form-group">
              <label htmlFor="country" className="control-label">{
                (state.dataType && state.dataType.model === 'country') ? 'Child country' : 'Country'
              }</label>
              <small className="help-block">The country whence we got the products or wither we are sending them.</small>
              <ClassificationSelector
                type="country"
                loading={!classifications.country.length}
                data={childClassifications || classifications.country.filter(c => !c.source)}
                onChange={actions.update.bind(null, 'countryClassification')}
                selected={selectors.countryClassification} />
              <ItemSelector
                type="country"
                disabled={!selectors.countryClassification || !groups.country.length}
                loading={selectors.countryClassification && !groups.country.length}
                data={groups.country}
                onChange={actions.update.bind(null, 'country')}
                selected={selectors.country} />
            </div>
            <div className="form-group">
              <label htmlFor="direction" className="control-label">Direction</label>
              <small className="help-block">The French harbor where the transactions were recorded.</small>
              <ItemSelector
                type="direction"
                loading={!directions}
                data={directions || []}
                onChange={actions.update.bind(null, 'direction')}
                selected={selectors.direction} />
            </div>
            <div className="form-group">
              <label htmlFor="kind" className="control-label">Kind</label>
              <small className="help-block">Should we look at import, export, or total?</small>
              <ItemSelector
                type="kind"
                onChange={actions.update.bind(null, 'kind')}
                selected={selectors.kind} />
            </div>
            <div className="form-group-fixed">
              <button
                type="submit"
                className="btn btn-default"
                data-loading={state.loading}
                disabled={!state.dataType}
                onClick={actions.addChart}>
                Update
              </button>
            </div>
          </form>
        </div>

        { /* Content panel */ }
        <div className="col-xs-12 col-sm-6 col-md-8">
          <div className="viz-data">
            {state.perYear && state.dataType && (
              <div className="box-viz">
                {state.perYear ?
                  <div>
                    <p>Total number of {unit} per year</p>
                    <DataQualityBarChart
                      yAxis
                      data={barData}
                      unit={unit}
                      syncId="sources-per-directions" />
                  </div> :
                  <Waiter />}
                <button
                  type="submit"
                  className="btn btn-default"
                  onClick={() => this.exportPerYear()}>
                  Export
                </button>
              </div>
            )}
            {canDisplaySecondViz && state.flowsPerYear && state.dataType && (
              <div className="box-viz">
                {state.flowsPerYear ?
                  <SourcesPerDirections data={state.flowsPerYear} /> :
                  <Waiter />}
                <button
                  type="submit"
                  className="btn btn-default"
                  onClick={() => this.exportFlows()}>
                  Export
                </button>
              </div>
            )}
          </div>
        </div>

        { /* Right panel */ }
        <div className="aside-legend">
          <ul className="list-unstyled list-legend">
            <li><span style={{backgroundColor: '#8d4d42'}} />Number direction</li>
            <li><span style={{backgroundColor: '#4F7178'}} />Number of flows</li>
          </ul>
          <p>Barcharts are sorted by average number of flows per year.</p>
        </div>
      </VizLayout>
    );
  }
}
