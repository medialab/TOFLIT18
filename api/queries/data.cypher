// name: regions
// Retrieving the list of the available regions.
//------------------------------------------------------------------------------
MATCH (d:Region)
RETURN
  d.id AS id,
  d.name AS name
ORDER BY d.name

// name: sourceTypes
// Retrieving the list of the distinct source types.
//------------------------------------------------------------------------------
MATCH (s:Source)
RETURN DISTINCT s.type AS type
ORDER BY s.type

// name: lastCommits
// Retrieving the last commits from source code and data repositories used to build the datascape
//------------------------------------------------------------------------------
MATCH(c:Commit) return c 
