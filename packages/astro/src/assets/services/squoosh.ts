// TODO: Investigate removing this service once sharp lands WASM support, as libsquoosh is deprecated

import type { ImageQualityPreset, OutputFormat } from '../types.js';
import { baseService, BaseServiceTransform, LocalImageService, parseQuality } from './service.js';
import { processBuffer } from './vendor/squoosh/image-pool.js';
import type { Operation } from './vendor/squoosh/image.js';

const baseQuality = { low: 25, mid: 50, high: 80, max: 100 };
const qualityTable: Record<Exclude<OutputFormat, 'png'>, Record<ImageQualityPreset, number>> = {
	avif: {
		// Squoosh's AVIF encoder has a bit of a weird behavior where `62` is technically the maximum, and anything over is overkill
		max: 62,
		high: 45,
		mid: 35,
		low: 20,
	},
	jpeg: baseQuality,
	jpg: baseQuality,
	webp: baseQuality,
	// Squoosh's PNG encoder does not support a quality setting, so we can skip that here
};

const service: LocalImageService = {
	getURL: baseService.getURL,
	parseURL: baseService.parseURL,
	getHTMLAttributes: baseService.getHTMLAttributes,
	async transform(inputBuffer, transformOptions) {
		const transform: BaseServiceTransform = transformOptions as BaseServiceTransform;

		let format = transform.format;
		if (!format) {
			format = 'webp';
		}

		const operations: Operation[] = [];

		// Never resize using both width and height at the same time, prioritizing width.
		if (transform.height && !transform.width) {
			operations.push({
				type: 'resize',
				height: transform.height,
			});
		} else if (transform.width) {
			operations.push({
				type: 'resize',
				width: transform.width,
			});
		}

		let quality: number | string | undefined = undefined;
		if (transform.quality) {
			const parsedQuality = parseQuality(transform.quality);
			if (typeof parsedQuality === 'number') {
				quality = parsedQuality;
			} else {
				quality =
					transform.quality in qualityTable[format]
						? qualityTable[format][transform.quality]
						: undefined;
			}
		}

		const data = await processBuffer(inputBuffer, operations, format, quality);

		return {
			data: Buffer.from(data),
			format: format,
		};
	},
};

export default service;
