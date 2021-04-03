import { Api, ICompilationResult, APIType, ILibrary, ICompiler, ICompilerFilters } from "@partouf/compilerexplorer-api";

export function pathScrubber(data: string) {
    return (data || '').
        replace(/(\\\"\.?\/.*\\\")/g, '\\"**Scrubbed-path**\\"').
        replace(/\"\.?\/.*\/.*\"/g, '"**Scrubbed-path**"').
        replace(/\"-Wl,-rpath,\/.*\"/g, '"-Wl,-rpath,**Scrubbed-path**"');
};

export function timeScrubber(data: string) {
    return (data || '').
        replace(/\s*\"[a-z]*time\"\:\s\"\d*\",/gi, '');
}

export function cacheScrubber(data: string) {
    return (data || '').
        replace(/\s*\"retreivedFromCache\"\:\s[truefals]*,/gi, '');
}

export function filtcountScrubber(data: string) {
    return (data || '').
        replace(/\s*\"filteredCount\"\:\s\d*,/gi, '');
}

export function asmSizeScrubber(data: string) {
    return (data || '').
        replace(/\s*\"asmSize\"\:\s\d*,/g, '');
};

export class TestConfig {
    public api?: Api;
    public defaultCompilerId: string = 'g92';
}

export class TrippleCompilationResult {
    public jsonResult: ICompilationResult;
    public textResult: ICompilationResult;
    public formResult?: ICompilationResult;

    public jsonResultAsm?: string;
    public textResultAsm?: string;
    public formResultAsm?: string;

    constructor(json: ICompilationResult, text: ICompilationResult, form?: ICompilationResult) {
        this.jsonResult = json;
        this.textResult = text;
        this.formResult = form;

        this.jsonResultAsm = this.jsonResult.asm?.map((item) => item.text).join('\n');
        this.textResultAsm = this.textResult.asm?.map((item) => item.text).join('\n');
        if (this.formResult)
            this.formResultAsm = this.formResult.asm?.map((item) => item.text).join('\n');
    }
}

export class CompilationPair {
    public name: string;
    public results: Promise<TrippleCompilationResult>;

    constructor(name: string, results: Promise<TrippleCompilationResult>) {
        this.name = name;
        this.results = results;
    }
}

const config = new TestConfig();
const compilationsByName: Array<CompilationPair> = [];

export function getConfig(): TestConfig {
    return config;
}

function initApis() {
    if (!process.env.CEURL) {
        throw 'Should set CEURL environment variable to the website URL to test';
    }

    if (process.env.DEFCOMPILERID) {
        config.defaultCompilerId = process.env.DEFCOMPILERID;
    }

    if (!config.api) {
        config.api = new Api({
            url: process.env.CEURL,
            defaultLanguage: 'c++',
            apiType: APIType.JSON,
        });
    }
}

export async function getCompiler(): Promise<ICompiler> {
    initApis();

    if (!config.api) throw 'Something went wrong with the jsonApi';

    return await config.api.compilers.findById(config.defaultCompilerId);
}

export async function doCompilation(source: string,  filters: ICompilerFilters, compilerArguments: Array<string> = [], libraries: Array<ILibrary> = []): Promise<TrippleCompilationResult> {
    initApis();

    const compiler = await getCompiler();

    compiler.apiOptions.apiType = APIType.Form;
    const formResult = await compiler.compile(source, compilerArguments, undefined, filters, libraries, undefined);

    compiler.apiOptions.apiType = APIType.Text;
    const textResult = await compiler.compile(source, compilerArguments, undefined, filters, libraries, undefined);

    compiler.apiOptions.apiType = APIType.JSON;
    const jsonResult = await compiler.compile(source, compilerArguments, undefined, filters, libraries, undefined);

    const result = new TrippleCompilationResult(
        jsonResult,
        textResult,
        formResult
    );

    return result;
}

export function findOrCreateCompilationByName(name: string, compilationFunc: CallableFunction): Promise<TrippleCompilationResult> {
    for (const p of compilationsByName) {
        if (p.name === name) {
            return p.results;
        }
    }

    const pair = new CompilationPair(name, compilationFunc());
    compilationsByName.push(pair);

    return pair.results;
}
