import { Api, ICompilationResult, APIType, ICompiler, ICompilerFilters } from "@partouf/compilerexplorer-api";

export function pathScrubber(data: string) {
    return (data || '').
        replace(/\"\.?\/.*\/.*\"/g, '"**Scrubbed-path**"').
        replace(/\"-Wl,-rpath,\/.*\"/g, "-Wl,-rpath,**Scrubbed-path**");
};

export class TestConfig {
    public jsonApi?: Api;
    public textApi?: Api;
    public formApi?: Api;
    public defaultCompilerId: string = 'g91';
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

    if (!config.jsonApi) {
        config.jsonApi = new Api({
            url: process.env.CEURL,
            defaultLanguage: 'c++',
            apiType: APIType.JSON,
        });
    }

    if (!config.textApi) {
        config.textApi = new Api({
            url: process.env.CEURL,
            defaultLanguage: 'c++',
            apiType: APIType.Text,
        });
    }

    if (!config.formApi) {
        config.formApi = new Api({
            url: process.env.CEURL,
            defaultLanguage: 'c++',
            apiType: APIType.Form,
        });
    }
}

export async function getJsonCompiler(): Promise<ICompiler> {
    initApis();

    if (!config.jsonApi) throw 'Something went wrong with the jsonApi';

    return await config.jsonApi.compilers.findById(config.defaultCompilerId);
}

export async function getTextCompiler(): Promise<ICompiler> {
    initApis();

    if (!config.textApi) throw 'Something went wrong with the textApi';

    return await config.textApi.compilers.findById(config.defaultCompilerId);
}

export async function getFormCompiler(): Promise<ICompiler> {
    initApis();

    if (!config.formApi) throw 'Something went wrong with the formApi';

    return await config.formApi.compilers.findById(config.defaultCompilerId);
}

export async function doCompilation(source: string,  filters: ICompilerFilters, compilerArguments: Array<string> = []): Promise<TrippleCompilationResult> {
    initApis();

    let formResult: any = undefined;

    const jsonCompiler = await getJsonCompiler();
    const textCompiler = await getTextCompiler();

    if (config.formApi) {
        const formCompiler = await getFormCompiler();
        formResult = await formCompiler.compile(source, compilerArguments, undefined, filters, undefined);
    }

    const result = new TrippleCompilationResult(
        await jsonCompiler.compile(source, compilerArguments, undefined, filters, undefined),
        await textCompiler.compile(source, compilerArguments, undefined, filters, undefined),
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
