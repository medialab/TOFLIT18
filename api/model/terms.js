/**
 * TOFLIT18 Viz ModelTerms
 * =======================
 *
 */
import decypher from 'decypher';
import database from '../connection';
import {tokenizeTerms} from '../../lib/tokenizer';
import {connectedComponents} from '../../lib/graph';
import Louvain from '../../lib/louvain';
import _, {omit, values} from 'lodash';

const {Expression, Query} = decypher;

const ModelTerms = {
    terms(classification, params, callback) {

        const {
          sourceType,
          direction,
          kind,
          country, 
          dateMin,
          dateMax
        } = params;

        const {
          productClassification,
          countryClassification
        } = params;

        const query = new Query(),
              where = new Expression(),
              withs = [];

        // Match product classification
        query.match('(pc)-[:HAS]->(group)');

        query.where('id(pc) = ' + classification);
        query.with('collect(group.name) as terms');

        //-- Do we need to match a country?
        if (countryClassification) {
            query.match('(cc)-[:HAS]->(cg)-[:AGGREGATES*0..]->(ci)');
            const whereCountry = new Expression('id(cc) = ' + countryClassification);
            query.params({countryClassification});

            if (country) {
              whereCountry.and('id(cg) = ' + country);
              query.params({country});
            }
            query.where(whereCountry);

            withs.push('terms');
            query.with(withs.concat('collect(ci.name) AS countries').join(', '));
        }

        // Match on flows with selectors choices
        query.match('(f:Flow)');
        where.and('f.product IN terms');

        //-- direction
        if (direction && direction !== '$all$') {
            query.match('(d:Direction)');
            where.and('id(d) = ' + direction);
            where.and('f.direction = d.name');
            query.params({direction});
        }

        // manage special sourceType
        if (sourceType && sourceType !== 'National best guess' && sourceType !== 'Local best guess') {
            where.and(`f.sourceType = "${sourceType}"`);
        }

        if (sourceType === 'National best guess') {
            where.and('(f.sourceType IN ["Objet Général", "Résumé"] or (f.sourceType= "National par direction" and f.year <> 1749 and f.year <> 1751))');
        }

        if (sourceType === 'Local best guess') {
            where.and('f.sourceType IN ["Local","National par direction"] ');
        }

        //-- Should we match a precise direction?
        if (countryClassification) {
            where.and('f.country IN countries');
        }

        //-- Import/Export
        if (kind === 'import')
            where.and('f.import');
        else if (kind === 'export')
            where.and('not(f.import)');

        if (dateMin)
            where.and('f.year >= ' + dateMin);

        if (dateMax)
            where.and('f.year <= ' + dateMax);

        if (!where.isEmpty())
            query.where(where);
        query.return('f.product as term');

        console.log("query.build() flowsPerYearPerDataType", query.build())

        database.cypher(query.build(), function(err, data) {
            //console.log("data", data);

            if (err) return callback(err);
            if (!data.length) return callback(null, null);

            const graph = {
                nodes: {},
                edges: {}
            };

            let edgeId = 0;

            data.forEach(row => {

                const terms = tokenizeTerms(row.term);

                if (terms.length <= 1)
                return;

                terms.forEach((term, i) => {

                  // Creating the node if it does not exist yet
                  if (!graph.nodes[term]) {
                    graph.nodes[term] = {
                      id: term,
                      label: term,
                      occurrences: 1,
                      position: i,
                      degree: 0,
                      neighbours: []
                    };
                  }
                  else {
                    graph.nodes[term].occurrences++;
                    graph.nodes[term].position = Math.min(i, graph.nodes[term].position);
                  }

                  const node = graph.nodes[term];

                  // Retrieving last node
                  if (!!i) {
                    const lastNode = graph.nodes[terms[i - 1]],
                          hash = `~${lastNode.id}~->~${node.id}~`,
                          reverseHash = `~${node.id}~->~${lastNode.id}~`;

                    // Increasing degree
                    lastNode.degree++;
                    node.degree++;

                    // Creating a relationship or weighting it once more
                    const edge = graph.edges[hash] || graph.edges[reverseHash];

                    if (!edge) {
                      graph.edges[hash] = {
                        id: edgeId++,
                        weight: 1,
                        source: lastNode.id,
                        target: node.id
                      };

                      node.neighbours.push(lastNode);
                      lastNode.neighbours.push(node);
                    }
                    else {
                      edge.weight++;
                    }
                  }
                });
            });

            // Detecting components
            const components = connectedComponents(values(graph.nodes));

            // Keeping only larger components
            let nodesToDrop = _(components)
                .filter(component => component.length < 4)
                .flatten()
                .value();

            nodesToDrop = new Set(nodesToDrop);

            // Dropping useless nodes
            graph.nodes = omit(graph.nodes, node => nodesToDrop.has(node.id));

            graph.edges = omit(graph.edges, edge => {
                return nodesToDrop.has(edge.source) ||
                       nodesToDrop.has(edge.target);
            });

            // Computing Louvain modularity
            const modularity = Louvain()
                .nodes(values(graph.nodes).map(node => node.id))
                .edges(values(graph.edges));

            const communities = modularity();

            const useful = _(communities)
                .values()
                .countBy()
                .pairs()
                .sortBy(([, count]) => -count)
                .take(20)
                .map(([community]) => +community)
                .value();

            const usefulSet = new Set(useful);

            values(graph.nodes).forEach(node => {
                const community = communities[node.id];

                node.community = usefulSet.has(community) ? community : -1;
                delete node.degree;
                delete node.neighbours;
            });

            // graph.edges = omit(graph.edges, edge => {
            //   return !usefulSet.has(graph.nodes[edge.source].community) ||
            //          !usefulSet.has(graph.nodes[edge.target].community);
            // });

            // graph.nodes = omit(graph.nodes, node => !usefulSet.has(node.community));

            return callback(null, {
                nodes: values(graph.nodes),
                edges: values(graph.edges)
            });
        });
    }
};

export default ModelTerms;
