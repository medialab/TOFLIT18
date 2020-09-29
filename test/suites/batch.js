import assert from "assert";
import Batch from "../../lib/batch";

describe("Neo4j Batches", function() {
  it("should be possible to compile complex batches.", function() {
    const batch = new Batch();

    const dairy = batch.save({ name: "Dairy products" }, ["ClassifiedItem", "ClassifiedProduct"]),
      milk = batch.save({ name: "Milk" }, "Item"),
      cheese = batch.save({ name: "Cheese" }, "Item");

    batch.relate(dairy, "AGGREGATES", milk);
    batch.relate(dairy, "AGGREGATES", cheese);
    batch.relate(45, "AGGREGATES", cheese);

    batch.update(45, { note: "Here you go." });
    batch.unrelate(45, "AGGREGATES", 46);

    const { query, params } = batch.compile();

    assert.deepEqual(query.split("\n"), [
      "MATCH (ne45)",
      "WHERE id(ne45) = 45",
      "MATCH (ne46)",
      "WHERE id(ne46) = 46",
      "MATCH (ne45)-[r0:`AGGREGATES`]->(ne46)",
      "SET ne45 += {pe45}",
      "CREATE (ni0 {pi0})",
      "SET ni0:`ClassifiedItem`",
      "SET ni0:`ClassifiedProduct`",
      "CREATE (ni1 {pi1})",
      "SET ni1:`Item`",
      "CREATE (ni2 {pi2})",
      "SET ni2:`Item`",
      "DELETE r0",
      "CREATE (ni0)-[:`AGGREGATES`]->(ni1)",
      "CREATE (ni0)-[:`AGGREGATES`]->(ni2)",
      "CREATE (ne45)-[:`AGGREGATES`]->(ni2);",
    ]);

    assert.deepEqual(params, {
      pe45: { note: "Here you go." },
      pi0: { name: "Dairy products" },
      pi1: { name: "Milk" },
      pi2: { name: "Cheese" },
    });
  });
});
