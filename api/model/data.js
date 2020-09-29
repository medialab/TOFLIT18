/**
 * TOFLIT18 Data Model
 * ====================
 *
 * Accessing generic data from the database.
 */
import database from "../connection";
import { data as queries } from "../queries";
import { sortBy } from "lodash";

const Model = {
  /**
   * Directions.
   */
  directions(callback) {
    return database.cypher(queries.directions, callback);
  },

  /**
   * Source types.
   */
  sourceTypes(callback) {
    return database.cypher(queries.sourceTypes, function(err, result) {
      // add national best guess Source Type
      result.push({ type: "National best guess" });
      result.push({ type: "Local best guess" });
      result = sortBy(result, "type");
      if (err) return callback(err);

      return callback(
        null,
        result.map(row => row.type),
      );
    });
  },
};

export default Model;
