/* eslint react/no-danger: 0 */
/**
 * TOFLIT18 Client Glossary View
 * ==============================
 *
 * Displaying the terms' glossary.
 */
import React, {Component} from 'react';
import {escapeRegexp} from 'talisman/regexp';
import papaparse from 'papaparse';
import cls from 'classnames';
import ajax from 'djax';
import VizLayout from '../misc/VizLayout.jsx';

/**
 * Constants.
 */
const URL_REGEX = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/gi;

/**
 * Main component.
 */
export default class GlossaryPanel extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      query: '',
      entries: [],
      glossary: []
    };

    this.handleInput = this.handleInput.bind(this);
  }

  componentDidMount() {
    ajax({
      url: [
        CONFIG.glossary.repository_url,
        CONFIG.git_branch,
        CONFIG.glossary.path
      ].join(''),
      dataType: 'string'
    }).then(data => {
      const result = papaparse.parse(data, {header: true});
      const glossaryData = result.data
        .filter(e => e.definition)
        .map(entry => {
          return {
            name: entry.marchandises,
            html: entry.definition.replace(URL_REGEX, match => {
              let label = match;
              if (match.length > 70) label = match.slice(0, 67) + '...';
              return `<a href="${match}">${label}</a>`;
            })
          };
        });
      this.setState({
        glossary: glossaryData,
        entries: glossaryData
      });
    });
  }

  handleInput(e) {
    const query = e.target.value;

    if (!query && this.state.entries.length !== this.state.glossary) {
      this.setState({query, entries: this.state.glossary});
    }
 else {
      this.setState({query});

      if (query.length > 2) this.performSearch(query);
      else this.performSearch('');
    }
  }

  performSearch(query) {
    if (!query) {
      this.setState({entries: this.state.glossary.slice(0)});
    }
 else {
      const pattern = new RegExp(escapeRegexp(query));

      const filteredEntries = this.state.glossary.filter(entry => {
        return pattern.test(entry.name) || pattern.test(entry.definition);
      });

      this.setState({entries: filteredEntries});
    }
  }

  render() {
    const {query} = this.state;
    const entries = this.state.entries.map((entry, index) => {
      return (
        <div key={index} className="well">
          <dt>{entry.name}</dt>
          <dd dangerouslySetInnerHTML={{__html: entry.html}} />
        </div>
      );
    });

    return (
      <VizLayout
        title="Glossary"
        description="This glossary gives identification and definitions of selected commodities that were exchanged between France and its economic partners. If you want to contribute a definition, or correct a mistake, please send an email to guillaume.daudin@dauphine.psl.eu"
        leftPanelName="Search">
        {/* Top of the left panel */}

        {/* Left panel */}
        <div className="aside-filters">
          <label htmlFor="classifications" className="control-label">
            Search
          </label>
          <form onSubmit={e => e.preventDefault()}>
            <div className="form-group">
              <input
                id="searchGroup"
                type="text"
                className="form-control"
                placeholder="Search products..."
                value={query}
                onChange={this.handleInput} />
            </div>
            <div className="form-group">
              <p
                className={cls(
                  (!entries.length || query.length <= 2) && 'hidden'
                )}>
                We found <strong>{entries.length}</strong> results found for "
                {query}"
              </p>
              <p className={cls(entries.length && 'hidden')}>
                We're sorry. We cannot find any matches for your search.
              </p>
            </div>
          </form>
        </div>
        {/* Content panel */}
        <div className="content-viz">
          <div className="col-xs-12 col-sm-6 col-md-8">
            <div className="row">
              <dl>{entries}</dl>
            </div>
          </div>
        </div>
      </VizLayout>
    );
  }
}
