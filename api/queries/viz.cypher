// name: sourcesPerDirections
// Return data concerning the available years per granularity (national/local)
// for each of the database's directions.
//------------------------------------------------------------------------------
MATCH (s:Source)<-[:TRANSCRIBED_FROM]-(f:Flow)-[:FROM|:TO]->(d:Direction)
WHERE s.type IN ["National par direction", "Local"]
RETURN
  d.name AS direction,
  f.year AS year,
  CASE s.type WHEN "Local" THEN "local" ELSE "national" END AS type,
  count(f) AS flows
ORDER BY f.year;


// name: network
// Building a network between directions and classified countries.
//------------------------------------------------------------------------------
START n=node({classification})
MATCH (n)-[:HAS]->(c)-[:AGGREGATES*0..]->(:Country)<-[:FROM|:TO]-(f:Flow)-[:FROM|:TO]->(d:Direction)
RETURN
  c.name AS country,
  d.name AS direction,
  count(f) AS count;
