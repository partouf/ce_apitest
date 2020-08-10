
import { expect } from 'chai';
import 'mocha';
import { ICompilerFilters, ICompilationResult } from '@partouf/compilerexplorer-api';
import { TrippleCompilationResult, doCompilation, findOrCreateCompilationByName, getJsonCompiler, getConfig, pathScrubber } from '../utils/utils';
import path from 'path';

const approvals = require('approvals');

const approvalsPath = path.join(__dirname, '../../approvals');

const CEScrubbers = approvals.scrubbers.multiScrubber([
    pathScrubber
]);

async function getDefaultSquareCompilation(): Promise<TrippleCompilationResult> {
    const source =
`int square(int num) {
    return num * num;
}
`;

    const filters = {
        binary: false,
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
        demangle: false,
        directives: true,
        intel: true,
        labels: true,
        commentOnly: true,
        libraryCode: false,
    } as ICompilerFilters
    
    return doCompilation(source, filters);
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
        const compiler = await getJsonCompiler();
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
});
