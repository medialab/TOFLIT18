/**
 * TOFLIT18 Client Terms Network Display
 * ======================================
 *
 * Displaying a network of product terms' decomposition.
 */
import React, {Component} from 'react';
import {format} from 'd3-format';
import {range} from 'lodash';
import Select from 'react-select';
import {branch} from 'baobab-react/decorators';
import {ClassificationSelector, ItemSelector} from '../misc/Selectors.jsx';
import Network from './viz/Network.jsx';
import VizLayout from '../misc/VizLayout.jsx';
import {exportCSV} from '../../lib/exports';
import {buildDateMin} from '../../lib/helpers';
import {
  selectTerms,
  selectNodeSize,
  selectEdgeSize,
  selectLabelSizeRatio,
  selectLabelThreshold,
  updateSelector as update,
  addChart,
  updateDate
} from '../../actions/terms';

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

/**
 * Helper rendering the node information display.
 */
const NUMBER_FIXED_FORMAT = format(',.2f'),
      NUMBER_FORMAT = format(',');

/**
 * Main component.
 */
export default class ExplorationGlobalsTerms extends Component {
  render() {
    return (
      <div>
        <TermsPanel />
      </div>
    );
  }
}

@branch({
  actions: {
    selectTerms,
    selectNodeSize,
    selectEdgeSize,
    selectLabelSizeRatio,
    selectLabelThreshold,
    update,
    addChart,
    updateDate
  },
  cursors: {
    alert: ['ui', 'alert'],
    classifications: ['data', 'classifications', 'flat'],
    classificationIndex: ['data', 'classifications', 'index'],
    directions: ['data', 'directions'],
    sourceTypes: ['data', 'sourceTypes'],
    state: ['states', 'exploration', 'terms']
  }
})
class TermsPanel extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {selected: null};
    this.setSelectedNode = this.setSelectedNode.bind(this);
  }

  export() {
    exportCSV({
      data: this.props.state.data,
      name: 'Toflit18_Global_Trade_Countries_Terms_view.csv',
    });
  }

  setSelectedNode(selectedNode) {
    this.setState({selectedNode});
  }

  render() {
    const {
      alert,
      actions,
      classifications,
      classificationIndex,
      directions,
      sourceTypes,
      state: {
        graph,
        classification,
        nodeSize,
        edgeSize,
        labelSizeRatio,
        labelThreshold,
        loading,
        selectors,
        groups
      }
    } = this.props;

    let {
      state: {
        dateMin,
        dateMax
      }
    } = this.props;

    const {selectedNode} = this.state;

    const sourceTypesOptions = (sourceTypes || []).map(type => {
      return {
        name: type,
        value: type
      };
    });

    let dateMaxOptions, dateMinOptions;

    dateMin = actions.updateDate('dateMin');
    if (dateMin) {
      dateMaxOptions = dateMax ? dateMax : buildDateMin(dateMin.id, dateMax);
    }
    else {
      dateMaxOptions = dateMax ? dateMax : buildDateMin(dateMin, dateMax);
    }

    dateMax = actions.updateDate('dateMax');
    if (dateMax) {
      dateMinOptions = dateMin ? dateMin : buildDateMin(dateMin, dateMax.id);
    }
    else {
      dateMinOptions = dateMin ? dateMin : buildDateMin(dateMin, dateMax);
    }

    let childClassifications = [];

    if (classification)
      childClassifications = getChildClassifications(classificationIndex, classification);

    const directed = selectors.kind && selectors.kind.id !== 'total';

    return (
      <VizLayout
        title="Product terms"
        description="Choose a product classification and display a graph showing relations between terms of the aforementioned classification"
        leftPanelName="Filters"
        rightPanelName="Caption" >
        { /* Top of the left panel */ }
        <div className="box-selection">
          <h2 className="hidden-xs">
            <span className="hidden-sm hidden-md">Product</span> classification
          </h2>
          <ClassificationSelector
            type="product"
            loading={!classifications.product.length}
            data={classifications.product}
            onChange={actions.selectTerms}
            selected={classification} />
        </div>

        { /* Left panel */ }
        <div className="aside-filters">
          <h3>Filters</h3>
          <form onSubmit={e => e.preventDefault()}>
            <div className="form-group">
              <label htmlFor="sourceType" className="control-label">Source Type</label>
              <small className="help-block">From wich sources does the data comes from ?</small>
              <ItemSelector
                type="sourceType"
                data={sourceTypesOptions}
                loading={!sourceTypesOptions.length}
                onChange={actions.update.bind(null, 'sourceType')}
                selected={selectors.sourceType} />
            </div>
            <div className="form-group">
              <label htmlFor="product" className="control-label">Product</label>
              <small className="help-block">The type of product being shipped.</small>
              <ClassificationSelector
                type="product"
                placeholder="Child classification..."
                disabled={!childClassifications.length}
                loading={!classifications.product.length}
                data={childClassifications}
                onChange={actions.update.bind(null, 'childClassification')}
                selected={selectors.childClassification} />
              <ItemSelector
                type="product"
                disabled={!selectors.childClassification || !groups.child.length}
                loading={selectors.childClassification && !groups.child.length}
                data={groups.child}
                onChange={actions.update.bind(null, 'child')}
                selected={selectors.child} />
            </div>
            <div className="form-group">
              <label htmlFor="country" className="control-label">Country</label>
              <small className="help-block">The country whence we got the products or wither we are sending them.</small>
              <ClassificationSelector
                type="country"
                loading={!classifications.country.length}
                data={classifications.country.filter(c => !c.source)}
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
            <div className="form-group">
              <label htmlFor="dates" className="control-label">Dates</label>
              <small className="help-block">Choose one date or a range data</small>
              <div className="row">
                <div className="col-xs-6">
                  <ItemSelector
                    type="dateMin"
                    data={dateMinOptions}
                    onChange={actions.update.bind(null, 'dateMin')}
                    selected={selectors.dateMin} />
                </div>
                <div className="col-xs-6">
                  <ItemSelector
                    type="dateMax"
                    data={dateMaxOptions}
                    onChange={actions.update.bind(null, 'dateMax')}
                    selected={selectors.dateMax} />
                </div>
              </div>
            </div>
            <div className="form-group-fixed">
              <button
                className="btn btn-default"
                data-loading={loading}
                disabled={!classification}
                onClick={actions.addChart} >
                Update
              </button>
            </div>
          </form>
        </div>

        { /* Content panel */ }
        <Network
          ref={ref => this.networkComponent = ref}
          graph={graph}
          directed={directed}
          colorKey={'communityColor'}
          sizeKey={nodeSize}
          edgeSizeKey={edgeSize}
          labelThreshold={labelThreshold}
          labelSizeRatio={labelSizeRatio}
          setSelectedNode={this.setSelectedNode}
          alert={alert}
          loading={loading}
          className="col-xs-12 col-sm-6 col-md-8" />

        { /* Right panel */ }
        <div className="aside-legend">
          <form onSubmit={e => e.preventDefault()}>
            <div className="form-group">
              <label htmlFor="edgeSize" className="control-label">Edge</label>
              <small className="help-block">Thickness</small>
              <Select
                name="edgeSize"
                clearable={false}
                searchable={false}
                options={[
                  {
                    value: 'flows',
                    label: 'Nb of flows.',
                  }, {
                    value: 'value',
                    label: 'Value of flows.',
                  }
                ]}
                value={edgeSize}
                onChange={({value}) => actions.selectEdgeSize(value)} />
            </div>
            <div className="form-group">
              <label htmlFor="nodeSize" className="control-label">Node</label>
              <small className="help-block">Size</small>
              <Select
                name="nodeSize"
                clearable={false}
                searchable={false}
                options={[
                  {
                    value: 'flows',
                    label: 'Nb of flows.',
                  }, {
                    value: 'value',
                    label: 'Value of flows.',
                  }, {
                    value: 'degree',
                    label: 'Degree.',
                  }
                ]}
                value={nodeSize}
                onChange={({value}) => actions.selectNodeSize(value)} />
            </div>
            <div className="form-group">
              <label className="control-label">Color</label>
              <small className="help-block">Community Louvain</small>
            </div>
            <div className="form-group">
              <label htmlFor="labelSize" className="control-label">Label</label>
              <div className="row">
                <div className="col-xs-6">
                  <small className="help-block">Size</small>
                  <Select
                    name="labelSize"
                    clearable={false}
                    searchable={false}
                    options={range(1, 10).map(num => ({
                      value: num + '',
                      label: num + '',
                    }))}
                    value={labelSizeRatio + ''}
                    onChange={({value}) => actions.selectLabelSizeRatio(+value)} />
                </div>
                <div className="col-xs-6">
                  <small className="help-block">Threshold</small>
                  <Select
                    name="labelThreshold"
                    clearable={false}
                    searchable={false}
                    options={range(0, 20).map(num => ({
                      value: num + '',
                      label: num + '',
                    }))}
                    value={labelThreshold + ''}
                    onChange={({value}) => actions.selectLabelThreshold(+value)} />
                </div>
              </div>
            </div>

            {
              selectedNode ?
                <div className="node-display">
                  <ul className="list-unstyled">
                    <li><span className="title">{selectedNode.label}</span></li>
                    <li>Flows: <strong>{NUMBER_FORMAT(selectedNode.flows)}</strong></li>
                    <li>Value: <strong>{NUMBER_FIXED_FORMAT(selectedNode.value)}</strong></li>
                    <li>Degree: <strong>{NUMBER_FORMAT(selectedNode.degree)}</strong></li>
                  </ul>
                </div> :
                undefined
            }
          </form>
          <div className="form-group-fixed form-group-fixed-right">
            <button
              className="btn btn-default"
              onClick={() => this.export()}>
              Export
            </button>
          </div>
        </div>
      </VizLayout>
    );
  }
}
