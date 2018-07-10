/**
 * TOFLIT18 Viz Model
 * ===================
 *
 */
import config from 'config';
import decypher from 'decypher';
import database from '../connection';
import _ from 'lodash';
import filterItemsByIdsRegexps from './utils';

const {Expression, Query} = decypher;

const limits = config.get('api.limits');

const ModelFlowsPerYear = {

    /**
     * Flows per year per data type.
     */
    flowsPerYearPerDataType(dataType, params, callback) {

      const {
        sourceType,
        direction,
        kind,
        product,
        country
      } = params;

      let {
        productClassification,
        countryClassification
      } = params;

      let twofoldProduct = false,
          twofoldCountry = false;

      const query = new Query(),
            where = new Expression(),
            withs = [];

      // handle clasification dataType
      if (dataType !== 'direction' && dataType !== 'sourceType') {
      // a classification
        const [
          ,
          classificationType,
          classificationId
        ] = dataType.match(/(\w+)_(\d+)/) || [];

        if (classificationType === 'product') {
          productClassification = classificationId;

          if (params.productClassification)
            twofoldProduct = true;
        }
        else {
          countryClassification = classificationId;

          if (params.countryClassification)
            twofoldCountry = true;
        }

        dataType = classificationType;
      }

      //-- Do we need to match a product?
      if (productClassification && !twofoldProduct) {
        query.match('(pc)-[:HAS]->(pg)-[:AGGREGATES*0..]->(pi)');

        const whereProduct = new Expression('id(pc) = ' + productClassification);
        query.params({productClassification});

    
        if (product) {
          const productFilter = filterItemsByIdsRegexps(product, 'pg') 

          whereProduct.and(productFilter.expression);
          query.params(productFilter.params);
        }
      
        withs.push('products');
        query.where(whereProduct);

        if (dataType === 'product') {
          withs.push('classificationGroupName');
          query.with('pg.name as classificationGroupName, collect(pi.name) AS products');
        }
        else {
          query.with('collect(pi.name) AS products');
        }
      }

      // NOTE: twofold classification
      if (productClassification && twofoldProduct) {
        query.match('(pc)-[:HAS]->(pg)-[:AGGREGATES*0..]->(pi), (ppg)-[:AGGREGATES*0..]->(pg)');

        const whereProduct = new Expression('id(pc) = ' + productClassification);
        query.params({productClassification});

        if (product) {
          const productFilter = filterItemsByIdsRegexps(product, 'ppg') 

          whereProduct.and(productFilter.expression);
          query.params(productFilter.params);
        }

        withs.push('products');
        query.where(whereProduct);

        if (dataType === 'product') {
          withs.push('classificationGroupName');
          query.with('pg.name as classificationGroupName, collect(pi.name) AS products');
        }
        else {
          query.with('collect(pi.name) AS products');
        }
      }

      //-- Do we need to match a country?
      if (countryClassification && !twofoldCountry) {
        query.match('(cc)-[:HAS]->(cg)-[:AGGREGATES*0..]->(ci)');
        const whereCountry = new Expression('id(cc) = ' + countryClassification);
        query.params({countryClassification});

        if (country) {
          const countryFilter = filterItemsByIdsRegexps(country, 'cg')

          whereCountry.and(countryFilter.expression);
          query.params(countryFilter.params);
        }

        query.where(whereCountry);

        if (dataType === 'country')
          query.with(withs.concat('cg.name as classificationGroupName, collect(ci.name) AS countries').join(', '));
        else
          query.with(withs.concat('collect(ci.name) AS countries').join(', '));
      }

      // NOTE: twofold classification
      if (countryClassification && twofoldCountry) {
        query.match('(cc)-[:HAS]->(cg)-[:AGGREGATES*0..]->(ci), (ccg)-[:AGGREGATES*0..]->(cg)');
        const whereCountry = new Expression('id(cc) = ' + countryClassification);
        query.params({countryClassification});

     
        if (country) {
          const countryFilter = filterItemsByIdsRegexps(country, 'ccg')

          whereCountry.and(countryFilter.expression);
          query.params(countryFilter.params);
        }

        query.where(whereCountry);

        if (dataType === 'country')
          query.with(withs.concat('cg.name as classificationGroupName, collect(ci.name) AS countries').join(', '));
        else
          query.with(withs.concat('collect(ci.name) AS countries').join(', '));
      }

      //direction or sourceType requested
      query.match('(f:Flow)');

      //-- direction
      if (direction && direction !== '$all$') {
        query.match('(d:Direction)');
        where.and('id(d) = ' + direction);
        where.and('f.direction = d.name');
        query.params({direction});
      }

      //-- Import/Export
      if (kind === 'import')
        where.and('f.import');
      else if (kind === 'export')
        where.and('not(f.import)');

      if (dataType === 'sourceType' || dataType === 'direction')
        where.and(`exists(f.${dataType})`);

      where.and(`f.year >= ${limits.minYear}`);

      // manage special sourceType
      if (sourceType && sourceType !== 'National best guess' && sourceType !== 'Local best guess') {
        where.and(`f.sourceType = "${sourceType}"`);
      }

      if (sourceType === 'National best guess') {
        where.and('(f.sourceType IN ["Objet Général", "Résumé", "Tableau des quantités"] or (f.sourceType= "National toutes directions tous partenaires" and f.year <> 1749 and f.year <> 1751))');
      }

      if (sourceType === 'Local best guess') {
        where.and('f.sourceType IN ["Local","National toutes directions tous partenaires"] ');
      }

      //-- Should we match a precise direction?
      if (countryClassification) {
        where.and('f.country IN countries');
      }

      if (productClassification) {
        where.and('f.product IN products');
      }

      if (!where.isEmpty())
        query.where(where);

      let dataTypeField;
      // dataType resolution
      if (dataType === 'sourceType' || dataType === 'direction')
          dataTypeField = 'f.' + dataType;
      else
          dataTypeField = 'classificationGroupName';

      //-- Special return for each sourceType or if no sourceType
      if (sourceType && sourceType !== 'National best guess' && sourceType !== 'Local best guess') {
        query.return(dataTypeField + ' AS dataType, count(f) AS flows, f.year AS year');
        query.orderBy('f.year, dataType');
      }
      else if (sourceType === 'National best guess') {
        query.with('f.year AS year, ' + dataTypeField + ' AS dataType, collect(f) as flows_by_year, collect(distinct(f.sourceType)) as source_types');
        query.with('year, dataType, CASE  WHEN size(source_types)>1 and "Objet Général" in source_types THEN filter(fb in flows_by_year where fb.sourceType="Objet Général") WHEN size(source_types)>1 and "Tableau des quantités" in source_types THEN filter(fb in flows_by_year where fb.sourceType="Tableau des quantités") WHEN size(source_types)>1 and "Résumé" in source_types THEN filter(fb in flows_by_year where fb.sourceType="Résumé") WHEN size(source_types)>1 and "National toutes directions tous partenaires" in source_types THEN filter(fb in flows_by_year where fb.sourceType="National toutes directions tous partenaires") ELSE flows_by_year END as flowsbyyear UNWIND flowsbyyear as fs');
        query.return('dataType, year, count(fs) AS flows');
        query.orderBy('year, dataType');
      }
      else if (sourceType === 'Local best guess') {
        query.with(' f.year AS year, ' + dataTypeField + ' as dataType, collect(f) as flows_by_year, collect(distinct(f.sourceType)) as source_types');
        query.with(' year, dataType, CASE  WHEN size(source_types)>1 and "Local" in source_types THEN filter(fb in flows_by_year where fb.sourceType="Local") WHEN size(source_types)>1 and "National toutes directions tous partenaires" in source_types THEN filter(fb in flows_by_year where fb.sourceType="National toutes directions tous partenaires") ELSE flows_by_year END as flowsbyyear UNWIND flowsbyyear as fs');
        query.return('dataType, year, count(fs) AS flows');
        query.orderBy('year, dataType');
      }
      else {
        query.return(dataTypeField + ' AS dataType, count(f) AS flows, f.year AS year');
        query.orderBy('f.year, dataType');
      }
      console.log(query.interpolate())
      database.cypher(query.build(), function(err, result) {
        if (err) return callback(err);

        const data = _(result)
          .groupBy('dataType')
          .mapValues((rows, key) => {
            return {
              name: key,
              data: rows.map(e => _.pick(e, ['year', 'flows']))
            };
          })
          .values();

        return callback(null, data);
      });
    }
};

export default ModelFlowsPerYear;
