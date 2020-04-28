// name: info
// Retrieving basic information about the desired classification.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (c) WHERE id(c)=$id
RETURN c AS classification;

// name: getAll
// Retrieving every classifications.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (c:Classification)-[:CREATED_BY]->(a:User)
OPTIONAL MATCH (c)-[:BASED_ON]->(p:Classification)
RETURN
	c AS classification,
  	a.name AS author,
    id(p) AS parent,
    size((p)-[:HAS]->()) AS itemsCount,
    size((c)-[:HAS]->()) AS groupsCount,
    size([(c)-[:HAS]->()-[:AGGREGATES]->()]) AS unclassifiedItemsCount
ORDER BY id(c);

// name: rawGroups
// Retrieving every groups for the given classification.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (c)-[:HAS]->(group) WHERE id(c)=$id
RETURN id(group) AS id, group.name AS name
ORDER BY lower(group.name);

// name: group
// Retrieving every items for a given group in a classification
//------------------------------------------------------------------------------
EXPLAIN
MATCH  (group)-[:AGGREGATES]->(item) WHERE id(group)=$id
WITH group, item.name AS name, item.name =~$queryItem AS matched
ORDER BY matched, name
WITH group, collect({name:name, matched:matched}) AS items
RETURN group, items, size(items) as nbItems, size(filter(item in items where item.matched)) as nbMatchedItems;

// name: groupFrom
// Retrieving every items for a given group in a classification but listing items from an upper classification
//------------------------------------------------------------------------------
EXPLAIN
MATCH  (group)-[:AGGREGATES*1..]->(item)<-[:HAS]-(ci)
WHERE id(group)=$id AND id(ci)=$queryItemFrom
WITH group, item.name AS name, item.name =~$queryItem AS matched
ORDER BY matched, name
WITH group, collect({name:name, matched:matched}) AS items
RETURN group, items[$offsetItem..$limitItem] as items, size(items) as nbItems, size(filter(item in items where item.matched)) as nbMatchedItems;

// name: groups
// Retrieving a sample of groups for the given classification.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (cg)-[:HAS]->(group)-[:AGGREGATES]->(item)
WHERE  id(cg)=$id AND group.name =~ $queryGroup
WITH group, item
ORDER BY item.name
RETURN group, collect({name:item.name})[$offsetItem..$limitItem] as items, size((group)-[:AGGREGATES]->()) as nbItems;

// name: groupsFrom
// Retrieving a sample of groups for the given classification but listing items from an upper classification.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (cg)-[:HAS]->(group)-[:AGGREGATES*1..]->(item)<-[:HAS]-(ci)
WHERE  id(cg)=$id AND group.name =~ $queryGroup$ AND id(ci)=$queryItemFrom
WITH group, item
ORDER BY group.name, item.name
RETURN group, collect({name:item.name})[$offsetItem..$limitItem] as items, size(collect(item)) as nbItems;

// name: searchGroups
// Searching a sample of groups for the given classification.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (cg)-[:HAS]->(group)-[:AGGREGATES]->(item)
WHERE
	id(cg)=$id AND
	group.name =~ $queryGroup  AND
    item.name =~ $queryGroup

WITH distinct group
SKIP $offset
LIMIT $limit

MATCH (group)-[:AGGREGATES]->(item)
WITH group, item.name AS name, item.name =~$queryItem AS matched
ORDER BY matched, name
WITH group, collect({name:name,matched:matched}) AS items
RETURN group, items[$offsetItem..$limitItem] as items, size(items) as nbItems, size(filter(item in items where item.matched)) as nbMatchedItems;

// name: searchGroupsFrom
// Searching a sample of groups for the given classification but listing items from an upper classification.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (cg)-[:HAS]->(group)-[:AGGREGATES*1..]->(item)<-[:HAS]-(ci)
WHERE id(cg)=$id AND
	    group.name =~ $queryGroup AND
      item.name =~ $queryItem AND
      id(ci)=$queryItemFrom
WITH distinct group
SKIP $offset
LIMIT $limit

OPTIONAL MATCH (group)-[:AGGREGATES*1..]->(item)<-[:HAS]-(ci)
WHERE id(ci)=$queryItemFrom
WITH group, item.name AS name, item.name =~$queryItem AS matched
ORDER BY matched, name
WITH group, collect({name:name,matched:matched}) AS items
RETURN group, items[$offsetItem..$limitItem] as items, size(items) as nbItems, size(filter(item in items where item.matched)) as nbMatchedItems;


// name: searchGroupsSource
// Searching a sample of groups for the given source classification.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (c)-[:HAS]->(group)
WHERE id(c)=$id AND  group.name =~ $queryGroup
WITH group
ORDER BY group.name
SKIP $offset
LIMIT $limit

RETURN group, [] as items, 0 as nbItems;

// name: allGroups
// Retrieving every groups for the given classification.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (c)-[:BASED_ON]->(:Classification)-[:HAS]->(item)
WHERE id(c)=$id
OPTIONAL MATCH (c)-[:HAS]->(group:ClassifiedItem)-[:AGGREGATES]->(item)
RETURN
  group.name AS group,
  id(group) AS groupId,
  item.name AS item,
  id(item) AS itemId;

// name: allGroupsToSource
// Retrieving every groups for the given classification but mapped to the
// source products themselves.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (item:Product)
OPTIONAL MATCH (item)<-[:AGGREGATES*1..]-(group:ClassifiedItem)<-[:HAS]-(c)
WHERE id(c) = $id
RETURN
  group.name AS group,
  id(group) AS groupId,
  item.name AS item,
  id(item) AS itemId;

// name: upper
// Retrieving every classifications based on the given one.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (c)<-[:BASED_ON]-(upper)
WHERE id(c)=$id
RETURN upper;

// name: upperGroups
// Retrieving upper groups of a classification with the associated items.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (c)-[:HAS]->(group)
WHERE id(c)=$id
RETURN group.name AS group, [(group)-[:AGGREGATES]->(item) | item.name] AS items;

// name: export
// Exporting data about the given classification in order to produce a CSV file.
//------------------------------------------------------------------------------
EXPLAIN
MATCH (c)-[:BASED_ON]->(p:Classification)-[:HAS]->(item)
WHERE id(c)=$id
OPTIONAL MATCH (c)-[:HAS]->(group:ClassifiedItem)-[:AGGREGATES]->(item)
RETURN
  c.slug AS name,
  p.slug AS parent,
  c.model AS model,
  group.name AS group,
  item.name AS item,
  group.note AS note,
  item:OutsiderClassifiedItem AS outsider;

