/*
|-------------------------------------------------------------------------
| UFO Database 
|-------------------------------------------------------------------------
|
| Create a database of UFO Sightings
|
*/

/**
 * Dependencies
 */

var http            = require('http'),
    cheerio         = require('cheerio'),
    ElasticSearch   = require('elasticsearchclient'),
    url             = require('url'),
    split           = require('strsplit'),
    crypto          = require('crypto');
    
    
    /**
     * Util
     */
    function isNumeric( varible )
    {
        return parseFloat( String( varible ) ) == varible;
    }

    /**
     * Elastic Search
     */
    
    var elasticSearchClient = new ElasticSearch({
        host: 'localhost',
        port: 9200,
        secure: false
    });
    
    var insert = function( data )
    {
        var id = crypto.createHash('md5').update(data.url).digest('hex');
        
        elasticSearchClient.index(
            'ufo',                          // the index name
            'sighting',                     // the document type
            data,                           // the document data
            id                              // Create unique hash of URL for ID
        ).on('data', function(response) {
            response = JSON.parse(response);
            if (response['ok'] == true) {
                console.log('info', "+" + data.url + " indexed");
            } else {
                console.log('error', response);
            }
        }).on('error', function(err) {
            console.log('error', "-" + data.url );
            console.log('error', err);
        }).exec();
    }
    
    //Crawl!
    var crawl = function( crawlOptions )
    {
        //HTTP Request
        var req = http.get(crawlOptions.hostname + crawlOptions.path, function(res) {
                
                console.log('Crawling ' + crawlOptions.hostname + crawlOptions.path + '...\n');
                
                //buff stash
                var html = '';
                
                //collect buff
                res.on('readable', function() {
                    html += res.read();
                });
                
                //read/parse/store buff
                res.on('end', function() {
                    
                    //create DOM to parse
                    $ = cheerio.load( html );
                    
                    //Get URI Segs
                    var uri = split( crawlOptions.path, '/', 3 );
                    
                    if ( isNumeric(uri[0]) )
                    {
                                                
                        //Get Metadata
                        var meta = $('tbody tr:first-child td:first-child font:first-child').html();
                        
                        //if no meta, exit
                        if ( meta !== null ) {
                             
                            //Get Columns
                            var columns = split( meta, '<br>', 6 );
                            
                            //Get City, State
                            var location = split( columns[3].replace(/\s+/g, ' ').replace(/Location: /, ''), ',', 2 );
                            
                            //Build index data
                            var data = {
                                'url' : crawlOptions.hostname + crawlOptions.path,
                                'body': $('body').text().replace(/\s+/g, ' '), //plaintext contents of page
                                'occurred': columns[0].replace(/\s+/g, ' ').replace(/Occurred : /, ''),
                                'reported': columns[1].replace(/\s+/g, ' ').replace(/Reported: /, ''),
                                'posted': columns[2].replace(/\s+/g, ' ').replace(/Posted: /, ''),
                                'city': location[0],
                                'state': location[1],
                                'shape': columns[4].replace(/\s+/g, ' ').replace(/Shape: /, ''),
                                'duration': columns[5].replace(/\s+/g, ' ').replace(/Duration:/, ''),
                                'description': $('tbody tr:nth-child(2) td:first-child font:first-child').text().replace(/\s+/g, ' ')
                            }
                            
                            //insert
                            if ( data.body !== '' || data.body !== undefined ) {
                                insert( data )
                            }
                        }
                    }
                                        
                    /**
                     * get regular links
                     */
                    
                    $('a').each(function(i,item){
                        
                        link = $(this).attr('href');
                        
                        //RULES!
                        if ( link !== undefined &&
                             link.match('ndxloc') == null &&
                             link.match('ndxevent') == null &&
                             link.match('ndxpost') == null &&
                             link.match('ndxshape') == null &&
                             link.match('www') == null
                        )
                        {
                            crawl({
                                hostname: 'http://www.nuforc.org/webreports/',
                                path: link
                            })
                        }
                        
                    });
                    
                }); 
        });
        
        //Log errors
        req.on('error', function(e) {
                console.log('problem with request: ' + e.message);
                console.log('hostname: ' + crawlOptions.hostname);
                console.log('path: ' + crawlOptions.path);
        });
        
    }
    
    /**
     * Set alpha point
     */

    crawl({
            hostname: 'http://www.nuforc.org',
            path: '/webreports/ndxloc.html'
    });
    
//end file