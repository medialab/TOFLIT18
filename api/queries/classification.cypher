// name: getAll
// Retrieving every classifications.
//------------------------------------------------------------------------------
MATCH (c:Classification)-[:CREATED_BY]->(a:User)
OPTIONAL MATCH (c)-[:BASED_ON]->(p:Classification)
OPTIONAL MATCH (c)-[:HAS]->(group)
RETURN
  c AS classification,
  a.name AS author,
  id(p) AS parent,
  count(group) AS nb_groups;

// name: groups
// Retireving a sample of groups for the given classification.
//------------------------------------------------------------------------------
START c=node({id})
MATCH (c)-[:HAS]->(group)
WITH group
ORDER BY group.name
SKIP {offset}
LIMIT {limit}

OPTIONAL MATCH (group)-[:AGGREGATES]->(item)
WITH group, item ORDER BY item.name
WITH group, collect(item.name) AS items

RETURN group, items;

// name: searchGroups
// Searching a sample of groups for the given classification.
//------------------------------------------------------------------------------
START c=node({id})
MATCH (c)-[:HAS]->(group)
WHERE group.name =~ {query}
WITH group
ORDER BY group.name
SKIP {offset}
LIMIT {limit}

OPTIONAL MATCH (group)-[:AGGREGATES]->(item)
WITH group, item ORDER BY item.name
WITH group, collect(item.name) AS items

RETURN group, items;

// name: export
// Exporting data about the given classification in order to produce a CSV file.
//------------------------------------------------------------------------------
START c=node({id})
MATCH (c)-[:BASED_ON]->(p:Classification)-[:HAS]->(item)
OPTIONAL MATCH (c)-[:HAS]->(group:ClassifiedItem)-[:AGGREGATES]->(item)
RETURN
  c.slug AS name,
  p.slug AS parent,
  c.model AS model,
  group.name AS group,
  item.name AS item,
  group.note AS note,
  item:OutsiderClassifiedItem AS outsider;
