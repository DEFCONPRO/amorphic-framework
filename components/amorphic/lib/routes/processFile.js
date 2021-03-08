'use strict';

let Logger = require('../utils/logger');
let logMessage = Logger.logMessage;
let formidable = require('formidable');
let fs = require('fs');
let statsdUtils = require('@havenlife/supertype').StatsdHelper;

/**
 * Purpose unknown
 *
 * @param {unknown} req unknown
 * @param {unknown} resp unknown
 * @param {unknown} next unknown
 * @param {unknown} downloads unknown
 */
function processFile(req, resp, next, downloads) {
    let processFileTime = process.hrtime();

    if (!downloads) {
        logMessage('no download directory');
        next();

        return;
    }

    let form = new formidable.IncomingForm();
    form.uploadDir = downloads;

    let isFormParserInErrorState = false;

    /**
     * in error state, due to the event emitter pattern being used in our form library,
     * this gets called twice => once on "error" and once more on "end".
     *
     * to make sure that we haven't already tried to execute this code before if we're in an error
     * state, keep a boolean switch saying whether this code has been hit yet or not.
     *
     * we don't need to worry about this issue in a success condition.
     */
    form.parse(req, function ee(err, _fields, files) {
        if (err || isFormParserInErrorState) {
            isFormParserInErrorState = true;
            logMessage(err);

            resp.status(500);
            resp.end('unable to parse form');
            logMessage(err);
            statsdUtils.computeTimingAndSend(
                processFileTime,
                'amorphic.webserver.process_file.response_time',
                { result: 'there was an error parsing the form' }
            );

            return;
        }
        try {
            let file = files.file.path;
            logMessage(file);

            setTimeout(function yz() {
                fs.unlink(file, function zy(err) {
                    if (err) {
                        logMessage(err);
                    }
                    else {
                        logMessage(file + ' deleted');
                    }
                });
            }, 60000);

            let fileName = files.file.name;
            req.session.file = file;
            resp.writeHead(200, {'content-type': 'text/html'});
            resp.end('<html><body><script>parent.amorphic.prepareFileUpload(\'package\');' +
                'parent.amorphic.uploadFunction.call(null, "' +  fileName + '"' + ')</script></body></html>');
            statsdUtils.computeTimingAndSend(
                processFileTime,
                'amorphic.webserver.process_file.response_time',
                { result: 'success' });
        } catch (err) {
            resp.writeHead(400, {'Content-Type': 'text/plain'});
            resp.end('Invalid request parameters');
            logMessage(err);
            statsdUtils.computeTimingAndSend(
                processFileTime,
                'amorphic.webserver.process_file.response_time',
                { result: 'Invalid request parameters, file or path params cannot be blank' }
            );
        }
    });
}

module.exports = {
    processFile: processFile
};
