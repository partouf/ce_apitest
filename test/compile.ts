
import { expect } from 'chai';
import 'mocha';
import { ICompilerFilters, ICompilationResult } from '@partouf/compilerexplorer-api';
import { TrippleCompilationResult, doCompilation, findOrCreateCompilationByName, getCompiler, getConfig, pathScrubber, asmSizeScrubber, timeScrubber, filtcountScrubber, cacheScrubber } from '../utils/utils';
import path from 'path';

const approvals = require('approvals');

const approvalsPath = path.join(__dirname, '../../approvals');

const CEScrubbers = approvals.scrubbers.multiScrubber([
    pathScrubber,
    asmSizeScrubber,
    timeScrubber,
    filtcountScrubber,
    cacheScrubber
]);

async function getDefaultSquareCompilation(): Promise<TrippleCompilationResult> {
    const source =
`int square(int num) {
    return num * num;
}
`;

    const filters = {
        binary: false,
        execute: false,
        demangle: true,
        directives: true,
        intel: true,
        labels: true,
        commentOnly: true,
        libraryCode: false,
    } as ICompilerFilters
    
    return doCompilation(source, filters);
}

async function getDefaultSquareNodemangleCompilation(): Promise<TrippleCompilationResult> {
    const source =
`int square(int num) {
    return num * num;
}
`;

    const filters = {
        binary: false,
        execute: false,
        demangle: false,
        directives: true,
        intel: true,
        labels: true,
        commentOnly: true,
        libraryCode: false,
    } as ICompilerFilters
    
    return doCompilation(source, filters);
}

async function getDefaultSquareExecution(): Promise<TrippleCompilationResult> {
    const source =
`int square(int num) {
    return num * num;
}

#include <iostream>

int main(int argc, char **argv) {
    std::cout << "Hello, World\\n";

    return square(argc + 1);
}
`;
    
    const filters = {
        binary: false,
        demangle: false,
        directives: true,
        execute: true,
        intel: true,
        labels: true,
        commentOnly: true,
        libraryCode: false,
    } as ICompilerFilters

    return doCompilation(source, filters, ['-O3', '-std=c++2a']);
}

async function getLibraryExecution(): Promise<TrippleCompilationResult> {
    const source =
`#include <catch2/catch_test_macros.hpp>
#include <fmt/core.h>
#include <string>

TEST_CASE( "Fmt test", "[fmt]" ) {
    REQUIRE( fmt::format("The answer is {:d}", 42)
        == "The answer is 42" );
}
`;

    const filters = {
        binary: false,
        demangle: false,
        directives: true,
        execute: true,
        intel: true,
        labels: true,
        commentOnly: true,
        libraryCode: false,
    } as ICompilerFilters

    const libraries = [
        {
            id: "fmt",
            version: "700"
        },
        {
            id: "catch2",
            version: "300-preview2"
        }
    ];

    return doCompilation(source, filters, ['-O3', '-lCatch2Main'], libraries);
}

function testCompilationSuccess(result: ICompilationResult) {
    expect(result.code).equal(0);
    expect(result.asm?.length).not.equal(0);
    expect(result.stdout?.length).equal(0);
    expect(result.stderr?.length).equal(0);
}


describe('Api initialization', () => {
    it('Should have a compiler', async () => {
        const config = getConfig();
        const compiler = await getCompiler();
        expect(compiler.id).equal(config.defaultCompilerId);
        expect(compiler.supportsExecution()).true;
    });
});

describe('Square example', async () => {
    it('Should compile succesfully', async () => {
        const results = await findOrCreateCompilationByName('defaultsquare', getDefaultSquareCompilation);

        testCompilationSuccess(results.jsonResult);
        testCompilationSuccess(results.textResult);
        if (results.formResult)
            testCompilationSuccess(results.formResult);
    });

    it('Should have some valid asm', async () => {
        const results = await findOrCreateCompilationByName('defaultsquare', getDefaultSquareCompilation);

        expect(results.jsonResultAsm).includes('mul');
        expect(results.jsonResultAsm).includes('ret');

        expect(results.textResultAsm).includes('mul');
        expect(results.textResultAsm).includes('ret');

        if (results.formResult) {
            expect(results.formResultAsm).includes('mul');
            expect(results.formResultAsm).includes('ret');
        }
    });

    it('Should demangle', async () => {
        const results = await findOrCreateCompilationByName('defaultsquare', getDefaultSquareCompilation);

        expect(results.jsonResultAsm).includes('square(int)');
        expect(results.textResultAsm).includes('square(int)');
        if (results.formResult) {
            expect(results.formResultAsm).includes('square(int)');
        }
    });

    it('Should not demangle', async () => {
        const results = await findOrCreateCompilationByName('defaultsquarenodemangle', getDefaultSquareNodemangleCompilation);

        testCompilationSuccess(results.jsonResult);
        expect(results.jsonResultAsm).not.includes('square(int)');

        testCompilationSuccess(results.textResult);
        expect(results.textResultAsm).not.includes('square(int)');

        if (results.formResult) {
            testCompilationSuccess(results.jsonResult);
            expect(results.formResultAsm).not.includes('square(int)');
        }
    });

    it('approval 1', async () => {
        const testname = 'defaultsquarenodemangle';
        const results = await findOrCreateCompilationByName(testname, getDefaultSquareNodemangleCompilation);
        
        if (results.jsonResult) delete (results.jsonResult as any)['popularArguments'];

        approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_json`, results.jsonResult, CEScrubbers);
        approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_text`, results.textResult, CEScrubbers);
        
        if (results.formResult)
            approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_form`, results.formResult, CEScrubbers);
    });

    it('approval 2', async () => {
        const testname = 'defaultsquareexecution';
        const results = await findOrCreateCompilationByName(testname, getDefaultSquareExecution);
        
        if (results.jsonResult) delete (results.jsonResult as any)['popularArguments'];

        approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_json`, results.jsonResult, CEScrubbers);
        approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_text`, results.textResult, CEScrubbers);
        
        if (results.formResult)
            approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_form`, results.formResult, CEScrubbers);
    });

    it('approval lib', async () => {
        const testname = 'libraryexecution';
        const results = await findOrCreateCompilationByName(testname, getLibraryExecution);
        
        if (results.jsonResult) delete (results.jsonResult as any)['popularArguments'];

        approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_json`, results.jsonResult, CEScrubbers);
        approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_text`, results.textResult, CEScrubbers);
        
        if (results.formResult)
            approvals.verifyAsJSONAndScrub(approvalsPath, `${testname}_form`, results.formResult, CEScrubbers);
    });
});
