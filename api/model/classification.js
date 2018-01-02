/**
 * TOFLIT18 Classification Model
 * ==============================
 *
 */
import async from 'async';
import decypher from 'decypher';
import database from '../connection';
import {classification as queries} from '../queries';
import {stringify} from 'csv';
import Batch from '../../lib/batch';
import {groupBy, find, map} from 'lodash';
import {
  checkIntegrity,
  solvePatch,
  applyOperations,
  rewire
} from '../../lib/patch';

const {helpers: {searchPattern}} = decypher;

/**
 * Helpers.
 */
function makeTree(list, tree) {
  if (!tree) {
    const root = find(list, {source: true});
    tree = {...root};
  }

  tree.children = list.filter(e => e.parent === tree.id);

  tree.children.forEach(e => makeTree(list, e));

  return tree;
}

function computeCompletion(items, unclassified) {
  return (
    100 - ((unclassified * 100) / items)
  ) | 0;
}

/**
 * Model.
 */
const Model = {

  /**
   * Retrieving the list of every classifications.
   */
  getAll(callback) {
    return database.cypher(queries.getAll, function(err, results) {
      if (err) return callback(err);

      const classifications = results.map(row => {
        const source = row.classification.properties.source;

        return {
          ...row.classification.properties,
          id: row.classification._id,
          author: row.author,
          parent: !source ? row.parent : null,
          groupsCount: row.groupsCount,
          itemsCount: row.itemsCount,
          unclassifiedItemsCount: row.unclassifiedItemsCount,
          completion: computeCompletion(row.itemsCount, row.unclassifiedItemsCount)
        };
      });

      const groupedByModel = groupBy(classifications, c => c.model);

      const tree = {
        product: makeTree(groupedByModel.product),
        country: makeTree(groupedByModel.country)
      };

      return callback(null, tree);
    });
  },

  /**
   * Retrieving every one of the classification's groups.
   */
  groups(id, callback) {
    return database.cypher({query: queries.rawGroups, params: {id: database.int(id)}}, function(err, result) {
      if (err) return callback(err);
      if (!result.length) return callback(null, null);

      return callback(null, result);
    });
  },

 /**
 * Retrieving item of one group with limit offset.
 */
  group(id, opts, callback) {
    const params = {};
    // Casting
    params.id = database.int(id);
    // items limit offset are start/end slice indices
    params.limitItem = database.int(opts.limitItem + opts.offsetItem);
    params.offsetItem = database.int(opts.offsetItem);
    params.queryItem = searchPattern(opts.queryItem || '');

    if (opts.queryItemFrom)
      params.queryItemFrom = database.int(opts.queryItemFrom);

    const query = params.queryItemFrom ? queries.groupFrom : queries.group;

    return database.cypher({query, params}, function(err, result) {
      if (err) return callback(err);
      if (!result.length) return callback(null, null);
      const row = result[0];
      const group = {
        ...row.group.properties,
        items: row.items,
        nbItems: row.nbItems,
        id: row.group._id
      };
      if (opts.queryItem)
        group.nbMatchedItems = row.nbMatchedItems;
      return callback(null, group);
    });
  },


  /**
   * Retrieving a sample of the classification's groups.
   */
  search(id, opts, callback) {
    let query, params;

    if (!opts.source) {
      if (opts.queryItem)
        query = queries[opts.queryItemFrom ? 'searchGroupsFrom' : 'searchGroups'];
      else
        query = queries[opts.queryItemFrom ? 'groupsFrom' : 'groups'];

      params = {
        ...opts,
        id,
        queryGroup: searchPattern(opts.queryGroup || ''),
        queryItem: searchPattern(opts.queryItem || '')
      };
    }
    else {
      query = queries.searchGroupsSource;
      params = {
        ...opts,
        id,
        queryGroup: searchPattern(opts.queryGroup || '')
      };
    }

    if (opts.orderBy && opts.orderBy === 'name') {
      params.orderBy = 'group.name';
    }
    else {// default to group size
      if (opts.queryItem && 'nbMatches')
        params.orderBy = 'nbMatchedItems DESC';
      else
        params.orderBy = 'nbItems DESC';
    }

    // Casting
    params.id = database.int(params.id);
    params.limit = database.int(params.limit);
    params.offset = database.int(params.offset);
    // items limit offset are start/end slice indices
    params.limitItem = database.int(params.limitItem + params.offsetItem);
    params.offsetItem = database.int(params.offsetItem);

    if (params.queryItemFrom)
      params.queryItemFrom = database.int(params.queryItemFrom);

    return database.cypher(
      {
        query,
        params
      },
      function(err, results) {
        if (err) return callback(err);

        const groups = results.map(row => {
          const group = {
            ...row.group.properties,
            items: row.items,
            nbItems: row.nbItems,
            id: row.group._id
          };
          if (opts.queryItem)
            group.nbMatchedItems = row.nbMatchedItems;
          return group;
        });

        return callback(null, groups);
      }
    );
  },

  /**
   * Exporting to csv.
   */
  export(id, callback) {
    return database.cypher({query: queries.export, params: {id: database.int(id)}}, function(err, results) {
      if (err) return callback(err);
      if (!results.length) return callback(null, null);

      const {name, parent, model} = results[0];

      const headers = [name, parent, 'note', 'outsider'];

      const rows = results.slice(1).map(function(row) {
        return [
          row.group,
          row.item,
          row.note,
          '' + row.outsider
        ];
      });

      return stringify([headers].concat(rows), {}, function(e, csv) {
        if (e) return callback(e);

        return callback(null, {csv, name, model});
      });
    });
  },

  /**
   * Review the given patch for the given classification.
   */
  review(id, patch, callback) {
    return database.cypher({query: queries.allGroups, params: {id: database.int(id)}}, function(err1, classification) {
      if (err1) return callback(err1);
      if (!classification.length) return callback(null, null);

      // Checking integrity
      const integrity = checkIntegrity(
        map(classification, 'item'),
        map(patch, 'item')
      );

      // Applying the patch
      const operations = solvePatch(classification, patch);

      // Computing a virtual updated version of our classification
      const updatedClassification = applyOperations(classification, operations);

      // Retrieving upper classifications
      return database.cypher({query: queries.upper, params: {id: database.int(id)}}, function(err2, upper) {
        if (err2) return callback(err2);

        const ids = map(upper, c => c.upper._id);

        // Rewiring each upper classification
        return async.map(ids, function(upperId, next) {
          return database.cypher({query: queries.upperGroups, params: {id: database.int(upperId)}}, function(err3, upperGroups) {
            if (err3) return next(err3);

            const links = rewire(
              upperGroups,
              classification,
              updatedClassification,
              operations
            );

            return next(null, {id: upperId, links});
          });
        }, function(err4, rewires) {
          if (err4)
            return callback(err4);

          return callback(null, {
            integrity,
            operations,
            rewires,
            virtual: updatedClassification
          });
        });
      });
    });
  },

  /**
   * Commit the given patch operations.
   */
  commit(id, operations, callback) {
    async.waterfall([

      function getData(next) {
        return database.cypher({query: queries.info, params: {id: database.int(id)}}, next);
      },

      function computeBatch(result, next) {
        if (!result[0])
          return next(null, null);

        const batch = new Batch(database),
              classificationId = result[0].classification._id,
              newGroupsIndex = {};

        // Iterating through the patch's operations
        operations.forEach(function(operation) {

          // 1) Creating a new group
          if (operation.type === 'addGroup') {
            const groupNode = batch.save({name: operation.name}, 'ClassifiedItem');
            batch.relate(classificationId, 'HAS', groupNode);

            // Indexing
            newGroupsIndex[operation.name] = groupNode;
          }

          // 2) Renaming a group
          if (operation.type === 'renameGroup') {
            batch.update(operation.id, {name: operation.to});
          }

          // 3) Moving an item (deleting old relation before!)
          if (operation.type === 'moveItem') {
            const newTo = newGroupsIndex[operation.to],
                  newFrom = newGroupsIndex[operation.from];

            // NOTE: This could be factorized.

            // Dropping an item from its group
            if (operation.to === null && !newTo) {
              batch.unrelate(operation.fromId || newFrom, 'AGGREGATES', operation.itemId);
            }

            // Adding an item from limbo to a group
            else if (operation.from === null && !newFrom) {
              batch.relate(operation.toId || newTo, 'AGGREGATES', operation.itemId);
            }

            // Moving an item from group to group
            else {
              batch.unrelate(operation.fromId || newFrom, 'AGGREGATES', operation.itemId);
              batch.relate(operation.toId || newTo, 'AGGREGATES', operation.itemId);
            }
          }
        });

        batch.commit(next);
      }
    ], callback);
  }
};

export default Model;
