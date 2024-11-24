import gulp from 'gulp';
import concat from 'gulp-concat';
import htmlclean from 'gulp-htmlclean';
import autoprefixer from 'gulp-autoprefixer';
import cleanCSS from 'gulp-clean-css';
import * as sass from 'sass'
import gulpSass from 'gulp-sass';
import svgSprite from 'gulp-svg-sprite';
import terser from 'gulp-terser';
import babel from 'gulp-babel';
import notify from 'gulp-notify';
import sourcemaps from 'gulp-sourcemaps';
import * as del from 'del'; 
import browserSync from 'browser-sync';
import pug from 'gulp-pug';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs'; 
import through2 from 'through2';
import copy from 'gulp-copy';
import path from 'path';
import { readFile } from 'fs/promises';
import gzip from 'gulp-gzip';
import gzipStatic from 'connect-gzip-static';
import rev from 'gulp-rev';
import compression from 'compression';
import serveStatic from 'serve-static';

const { src, dest, series, parallel, watch } = gulp;

const argv = yargs(hideBin(process.argv)).argv;
const sassCompiler = gulpSass(sass);
const isProd = argv.prod;
const dist = isProd ? 'build' : 'dev';
const noop = () => through2.obj();

const clean = () => del.deleteAsync([dist]);
const cacheBust = () => {
    return src(`${dist}/**/*.{css,js}`)
        .pipe(rev())
        .pipe(dest(dist))
        .pipe(rev.manifest())
        .pipe(dest(dist));
};
// const resources = () => {
//     console.log("Сборка - " + dist)
//     return src('src/resources/**')
//         .pipe(dest(dist));
// };

// Асинхронное чтение данных из файла
const pugTask = async () => {
    const offers = JSON.parse(
        await readFile('./src/js/Data/_offers.json', 'utf-8')        
    );
    const ratings = JSON.parse(
        await readFile('./src/js/Data/_ratings.json', 'utf-8')
    );
    const catalogs = JSON.parse(
        await readFile('./src/js/Data/_catalogs.json', 'utf-8')
    );
    const similar = JSON.parse(
        await readFile('./src/js/Data/_similar.json', 'utf-8')
    );
    return src('src/pug/pages/**/*.pug')
        .pipe(
            pug({
                pretty: !isProd,
                locals: { 
                    _offers: offers,
                    _ratings: ratings,
                    _catalogs: catalogs,
                    _similar: similar,
                    preloadImages: ['/src/images/hero-bg.webp'],
                    preloadImages: ['/src/images/banner-bg.webp']
                },
            })
        )
        .pipe(dest(dist))
        .pipe(browserSync.stream());
};

const fonts = () => {
    return src('src/fonts/**/*.{woff,woff2}') 
        .pipe(copy(`${dist}/fonts`, { prefix: 2 })); 
};

const images = () => {
    return src('src/images/**/*.{webp,png,jpg,jpeg,gif,svg}')
        .pipe(copy(`${dist}/images`, { prefix: 2 })); 
};



const scss = () => {
    return src('src/styles/**/*.scss') 
        .pipe(!isProd ? sourcemaps.init() : noop())
        .pipe(sassCompiler().on('error', sassCompiler.logError))
        .pipe(autoprefixer({
            cascade: false
        }))
        .pipe(isProd ? cleanCSS({ level: 2 }) : noop()) 
        .pipe(!isProd ? sourcemaps.write() : noop()) 
        .pipe(dest(dist)) 
        .pipe(browserSync.stream());
};

const htmlMinify = () => {
    return src('src/**/*.html')
        .pipe(isProd ? htmlclean({ collapseWhitespace: true }) : noop())
        .pipe(dest(dist))
        .pipe(browserSync.stream());
};

const svgSprites = () => {
    return src('src/images/svg/**/*.svg')
        .pipe(svgSprite({
            mode: {
                stack: {
                    sprite: '../sprite.svg'
                }
            }
        }))
        .pipe(dest(`${dist}/images`));
};


const scripts = () => {
    return src([
        path.resolve('src/js/components/**/*.js'),
        path.resolve('src/js/main.js')
    ])
        .pipe(!isProd ? sourcemaps.init() : noop())
        .pipe(babel({
            presets: ['@babel/env']
        }))
        .pipe(concat('app.js'))
        .pipe(isProd ? terser().on('error', notify.onError()) : noop())
        .pipe(!isProd ? sourcemaps.write() : noop())
        .pipe(dest(dist))
        .pipe(browserSync.stream());
};

const compressFiles = () => {
    return src(`${dist}/**/*.{html,css,js}`)
        .pipe(gzip({ append: true })) 
        .pipe(dest(dist));
};

const watchFiles = () => {
    browserSync.init({
        server: {
            baseDir: dist,
            middleware: [
                compression(), // Включение gzip
                serveStatic(dist, { extensions: ['html'] }) // Отдача сжатых файлов
            ],
        },
        browser: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    });
};
// watch('src/resources/**', resources);
watch('src/**/*.html', htmlMinify);
watch('src/styles/**/*.scss', scss);
watch('src/images/svg/**/*.svg', svgSprites);
watch('src/js/**/*.js', scripts);
watch('src/pug/**/*.pug', pugTask).on('change', browserSync.reload);;
watch('src/images/**/*', images).on('change', browserSync.reload);
// watch('src/js/**/*.js', resources);

export const runClean = clean;
// export const runResources = resources;
export const runHtmlMinify = htmlMinify;
export const runSvgSprites = svgSprites;
export const runImages = images;
export const runScripts = scripts;

// export const build = series(clean, resources, images, fonts, htmlMinify, scss, svgSprites, scripts, watchFiles);
export const build = series(clean, parallel(images, fonts, pugTask, scss, svgSprites, scripts), compressFiles, cacheBust, watchFiles);
export default build;